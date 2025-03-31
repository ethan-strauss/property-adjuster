from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import os
import re

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Helper functions ---

def extract_price(text):
    sold_match = re.search(r'\bSP[:\s\$]*([\d,]{5,})', text, re.IGNORECASE)
    if sold_match:
        return int(sold_match.group(1).replace(',', '')), 'SP'

    list_match = re.search(r'\bLP[:\s\$]*([\d,]{5,})', text, re.IGNORECASE)
    if list_match:
        return int(list_match.group(1).replace(',', '')), 'LP'

    return None, 'None'

def extract_sqft(text):
    match = re.search(r'Est Fin Abv Gr[:\s]*([\d,]+)', text, re.IGNORECASE)
    if match:
        return int(match.group(1).replace(',', ''))
    return None

def extract_property_data(text):
    def search(pattern, group=1):
        match = re.search(pattern, text, re.IGNORECASE)
        return match.group(group).strip() if match else None

    def split_baths(bath_string):
        try:
            full, half = bath_string.split('.')
            return int(full), int(half)
        except:
            return None, None

    raw_baths = search(r'Baths:\s*([\d\.]+)')
    full_baths, half_baths = split_baths(raw_baths) if raw_baths else (None, None)

    price, price_source = extract_price(text)

    return {
        "price": price,
        "price_source": price_source,
        "square_footage": extract_sqft(text),
        "bedrooms": search(r'Beds:\s*(\d+)'),
        "bathrooms_full": full_baths,
        "bathrooms_half": half_baths,
        "basement_size": search(r'Est Tot Lower:\s*([\d,]+)'),
        "finished_basement": search(r'Est Fin Lower:\s*([\d,]+)'),
        "acreage": search(r'Acreage:\s*([\d\.]+)'),
        "year_built": search(r'Year Built:\s*(\d{4})'),
        "garage_spaces": search(r'Tot Grg Sp[:\s]*(\d+)')
    }

# --- Multi-file upload route ---

@app.route('/upload', methods=['POST'])
def upload_multiple_pdfs():
    if 'files[]' not in request.files:
        return jsonify({"error": "No files found"}), 400

    files = request.files.getlist('files[]')
    comps = []

    for file in files:
        if file.filename == '':
            continue

        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)

        extracted_text = ""
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                extracted_text += page.extract_text() or ""

        comp_data = extract_property_data(extracted_text)
        comp_data["filename"] = file.filename
        comps.append(comp_data)

    return jsonify({"comps": comps})

# --- Run server ---
if __name__ == '__main__':
    app.run(debug=True)
