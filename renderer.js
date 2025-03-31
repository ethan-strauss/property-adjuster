document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('pdf-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const resultsDiv = document.getElementById('results');
    const conditionSelectorsDiv = document.getElementById('comp-condition-selectors');
  
    function formatAdj(val) {
      const num = Number(val || 0);
      return `${num >= 0 ? '+' : '-'}$${Math.abs(num).toFixed(0)}`;
    }
  
    uploadInput.addEventListener('change', () => {
      const files = uploadInput.files;
      conditionSelectorsDiv.innerHTML = '';
  
      if (files.length < 1 || files.length > 6) return;
  
      for (let i = 0; i < files.length; i++) {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '5px';
  
        const label = document.createElement('label');
        label.textContent = `${files[i].name} Condition: `;
  
        const select = document.createElement('select');
        select.className = 'comp-condition';
        select.innerHTML = `
          <option value="0">Poor</option>
          <option value="1">Fair</option>
          <option value="2" selected>Average</option>
          <option value="3">Good</option>
          <option value="4">Excellent</option>
        `;
  
        label.appendChild(select);
        wrapper.appendChild(label);
        conditionSelectorsDiv.appendChild(wrapper);
      }
    });
  
    uploadBtn.addEventListener('click', async () => {
      const files = uploadInput.files;
      if (files.length < 1 || files.length > 6) {
        alert("Please upload between 1 and 6 PDF files.");
        return;
      }
  
      const subject = {
        sqft: parseInt(document.getElementById('subject-sqft').value || 0),
        year: parseInt(document.getElementById('subject-year').value || 0),
        beds: parseInt(document.getElementById('subject-beds').value || 0),
        full: parseInt(document.getElementById('subject-full').value || 0),
        half: parseInt(document.getElementById('subject-half').value || 0),
        acreage: parseFloat(document.getElementById('subject-acreage').value || 0),
        finish: parseInt(document.getElementById('subject-finish').value || 0),
        garage: parseInt(document.getElementById('subject-garage').value || 0),
        condition: parseInt(document.getElementById('subject-condition').value)
      };
  
      const compConditions = Array.from(document.querySelectorAll('.comp-condition'))
        .map(select => parseInt(select.value));
  
      const formData = new FormData();
      for (let file of files) {
        formData.append('files[]', file);
      }
  
      try {
        const res = await fetch('http://127.0.0.1:5000/upload', {
          method: 'POST',
          body: formData
        });
  
        const data = await res.json();
        const comps = data.comps;
  
        comps.forEach((comp, i) => {
          comp.sqft = parseInt((comp.square_footage || '0').toString().replace(/,/g, ''));
          comp.price = parseInt(comp.price || 0);
          comp.ppsf = comp.sqft ? (comp.price / comp.sqft) : 0;
          comp.beds = parseInt(comp.bedrooms || 0);
          comp.full = parseInt(comp.bathrooms_full || 0);
          comp.half = parseInt(comp.bathrooms_half || 0);
          comp.acreage = parseFloat(comp.acreage || 0);
          comp.year = parseInt(comp.year_built || 0);
          comp.basement_total = parseInt(comp.basement_size || 0);
          comp.finished = parseInt(comp.finished_basement || 0);
          comp.finished_percent = comp.basement_total > 0 ? (comp.finished / comp.basement_total) * 100 : 0;
          comp.garage = parseInt(comp.garage_spaces || 0);
        });
  
        const soldComps = comps.filter(c => c.price_source === 'SP');
        const avgPPSF = Math.round(
          soldComps.reduce((sum, c) => sum + (c.ppsf || 0), 0) / soldComps.length
        );
        const ppsfAdjustmentRate = Math.round(avgPPSF * 0.25);
  
        comps.forEach((comp, i) => {
          const compCondition = compConditions[i];
          const ageDiff = subject.year - comp.year;
          const acreageDiff = Math.abs(subject.acreage - comp.acreage);
  
          const adj = {
            size: Math.abs(subject.sqft - comp.sqft) <= 100 ? 0 : (subject.sqft - comp.sqft) * ppsfAdjustmentRate,
            beds: (subject.beds - comp.beds) * 3000,
            full: (subject.full - comp.full) * 3000,
            half: (subject.half - comp.half) * 1500,
            basement: ((subject.finish - comp.finished_percent) / 100) * 4500,
            acreage: Math.floor(acreageDiff / 0.1) * 1000,
            age: Math.abs(ageDiff) > 10 ? Math.floor(Math.abs(ageDiff) / 10) * 1000 * Math.sign(ageDiff) : 0,
            garage: (subject.garage - comp.garage) * 2500,
            condition: (subject.condition - compCondition) * 10000
          };
  
          comp.adjustments = adj;
          comp.total_adjustment = Object.values(adj).reduce((a, b) => a + b, 0);
          comp.adjusted_price = comp.price + comp.total_adjustment;
        });
  
        const table = `
          <h2>Adjusted Comp Summary</h2>
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Price</th>
                <th>PPSF</th>
                <th>Size</th>
                <th>Bed</th>
                <th>Full</th>
                <th>Half</th>
                <th>Basement</th>
                <th>Acreage</th>
                <th>Age</th>
                <th>Garage</th>
                <th>Condition</th>
                <th>Total Adj</th>
                <th>Adj Price</th>
              </tr>
            </thead>
            <tbody>
              ${comps.map(comp => `
                <tr>
                  <td>${comp.filename}</td>
                  <td>$${comp.price.toLocaleString()}</td>
                  <td>$${comp.ppsf.toFixed(2)}</td>
                  <td>${formatAdj(comp.adjustments.size)}</td>
                  <td>${formatAdj(comp.adjustments.beds)}</td>
                  <td>${formatAdj(comp.adjustments.full)}</td>
                  <td>${formatAdj(comp.adjustments.half)}</td>
                  <td>${formatAdj(comp.adjustments.basement)}</td>
                  <td>${formatAdj(comp.adjustments.acreage)}</td>
                  <td>${formatAdj(comp.adjustments.age)}</td>
                  <td>${formatAdj(comp.adjustments.garage)}</td>
                  <td>${formatAdj(comp.adjustments.condition)}</td>
                  <td><strong>${formatAdj(comp.total_adjustment)}</strong></td>
                  <td><strong>$${comp.adjusted_price.toFixed(0)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p><strong>Average PPSF (Sold Only):</strong> $${avgPPSF}</p>
          <p><strong>Size Adjustment Rate (25% of PPSF):</strong> $${ppsfAdjustmentRate}</p>
        `;
  
        resultsDiv.innerHTML = table;
  
        let paragraphSummary = `<h3>Adjustment Summary (Narrative)</h3>`;
        comps.forEach((comp, index) => {
          const { adjustments } = comp;
          const lines = [];
  
          if (adjustments.size !== 0) lines.push(`${adjustments.size > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.size).toFixed(0)} for size`);
          if (adjustments.beds !== 0) lines.push(`${adjustments.beds > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.beds).toFixed(0)} for bedroom count`);
          if (adjustments.full !== 0) lines.push(`${adjustments.full > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.full).toFixed(0)} for full bath count`);
          if (adjustments.half !== 0) lines.push(`${adjustments.half > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.half).toFixed(0)} for half bath count`);
          if (adjustments.basement !== 0) lines.push(`${adjustments.basement > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.basement).toFixed(0)} for finished basement %`);
          if (adjustments.acreage !== 0) lines.push(`${adjustments.acreage > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.acreage).toFixed(0)} for acreage`);
          if (adjustments.age !== 0) lines.push(`${adjustments.age > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.age).toFixed(0)} for age difference`);
          if (adjustments.garage !== 0) lines.push(`${adjustments.garage > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.garage).toFixed(0)} for garage space count`);
          if (adjustments.condition !== 0) lines.push(`${adjustments.condition > 0 ? 'Add' : 'Deduct'} $${Math.abs(adjustments.condition).toFixed(0)} for condition`);
  
          const direction = comp.total_adjustment > 0 ? 'Net upward' : comp.total_adjustment < 0 ? 'Net downward' : 'No net';
          const totalAdj = Math.abs(comp.total_adjustment).toFixed(0);
          paragraphSummary += `<p><strong>Comp ${index + 1} (${comp.filename}):</strong> ${lines.join(', ')}. ${direction} adjustment of $${totalAdj}.</p>`;
        });
  
        resultsDiv.innerHTML += paragraphSummary;
  
      } catch (err) {
        console.error(err);
        alert("Error uploading or processing files.");
      }
    });
  });
  