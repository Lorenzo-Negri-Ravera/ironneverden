// File: stacked_bar_chart.js
// Extracted and adapted from stacked_barchart.html

// NOTE: The JSON file path has been updated to match
// the structure of the other scripts (e.g., heatmap.js, grouped_bar_chart.js).
d3.json("../../data/lab2/Year_Events_UK.json").then(function(data) {
    
    // Set dimensions and margins
    const width = 928;
    const height = 500;
    const marginTop = 30;
    const marginRight = 150; 
    const marginBottom = 30;
    const marginLeft = 40;

    // Data transformation
    const keys = [...new Set(data.map(d => d.EVENT_TYPE))];
    const groupedData = d3.group(data, d => d.YEAR);
    const wideData = Array.from(groupedData, ([year, values]) => {
        const obj = { YEAR: year };
        for (const key of keys) {
            const item = values.find(d => d.EVENT_TYPE === key);
            obj[key] = item ? item.count : 0;
        }
        return obj;
    });
    wideData.sort((a, b) => d3.ascending(a.YEAR, b.YEAR));

    // Stack generator
    const series = d3.stack()
        .keys(keys)
        .offset(d3.stackOffsetExpand) // This creates the 100% stacked chart
        .value((d, key) => d[key])
        (wideData);

    // Set the scales / axes
    const x = d3.scaleBand()
        .domain(wideData.map(d => d.YEAR))
        .range([marginLeft, width - marginRight])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, 1]) // Domain is 0 to 1 (0% to 100%)
        .range([height - marginBottom, marginTop]);

    
    // Set the color
    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(d3.schemeTableau10); 


    // --- KEY CHANGE ---
    // Instead of d3.create("svg"), we select an existing SVG container
    // in the HTML file, just like the other scripts do.
    // Make sure you have <svg id="stacked-bar-chart-container"></svg> in your HTML.
    const svg = d3.select("#stacked-bar-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Add the groups and rectangles for the chart
    svg.append("g")
      .selectAll()
      .data(series)
      .join("g")
        .attr("fill", d => color(d.key))
      .selectAll("rect")
      // d.key is added to each element to be used in the tooltip
      .data(D => D.map(d => (d.key = D.key, d))) 
      .join("rect")
        .attr("x", d => x(d.data.YEAR))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
      
    // Add the tooltip
    .append("title")
      .text(d => {
          const originalData = d.data;
          const eventType = d.key;
          const count = originalData[eventType];
          let total = 0;
          keys.forEach(key => { total += originalData[key]; });
          const percent = (count / total * 100).toFixed(1);
          // Tooltip text translated
          return `${originalData.YEAR} - ${eventType}\nCount: ${count} (${percent}%)`;
        });

    // Add the x-axis (year)
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    // Add the y-axis (percentage)
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "%")) // Format as percentage
        .call(g => g.select(".domain").remove());
    

    // Build the legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width - marginRight + 20}, ${marginTop})`);

    const legendGroups = legend.selectAll("g")
      .data(keys)
      .join("g")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendGroups.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", d => color(d)); 

    legendGroups.append("text")
        .attr("x", 20)
        .attr("y", 12) 
        .text(d => d) 
        .style("font-size", "12px")
        .style("font-family", "Arial, sans-serif");


    // --- KEY CHANGE ---
    // The 'document.body.appendChild(svg.node());' line was removed
    // because we are now selecting an existing SVG.

}).catch(function(error) {
    // Update the path in the error and the container selector
    console.error("Error loading ../../data/lab2/Year_Events_UK.json:", error);
    d3.select("#stacked-bar-chart-container") // Select the container to show the error
      .append("text")
      .text("Error: could not load data."); // Error message translated
});