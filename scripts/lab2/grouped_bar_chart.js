// File: grouped_bar_chart.js


d3.json("../../data/lab2/Events_UK_RU.json").then(function(data) {
    
    // dimensions and margins
    const width = 928;
    const height = 600;
    const marginTop = 30;
    const marginRight = 10;
    const marginBottom = 20;
    const marginLeft = 60;

    
    //
    const eventTypes = [...new Set(data.map(d => d.EVENT_TYPE))].sort(d3.ascending);
    const fx = d3.scaleBand()
        .domain(eventTypes)
        .rangeRound([marginLeft, width - marginRight])
        .paddingInner(0.1);

    // X (inner bars) encodes the COUNTRY
    const countries = [...new Set(data.map(d => d.COUNTRY))].sort();
    const x = d3.scaleBand()
        .domain(countries)
        .rangeRound([0, fx.bandwidth()])
        .padding(0.05);

    // Color encodes the COUNTRY
    const color = d3.scaleOrdinal()
        .domain(countries)
        .range(d3.schemeCategory10); // Assigns colors to Russia and Ukraine

    // Y (height) encodes the COUNT
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)]).nice()
        .rangeRound([height - marginBottom, marginTop]);

    // 4. Select the SVG container
    const svg = d3.select("#grouped-bar-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Append a group for each EVENT TYPE and a rect for each COUNTRY
    svg.append("g")
      .selectAll()
      .data(d3.group(data, d => d.EVENT_TYPE)) // Group by EVENT TYPE
      .join("g")
        .attr("transform", ([eventType]) => `translate(${fx(eventType)},0)`) // Position the group
      .selectAll()
      .data(([, d]) => d) // Bind the inner data (the two countries)
      .join("rect")
        .attr("x", d => x(d.COUNTRY))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => y(0) - y(d.count)) // <-- CORRETTO
        .attr("fill", d => color(d.COUNTRY))
    
    // Add a tooltip
    .append("title")
      .text(d => `Type: ${d.EVENT_TYPE}\nCountry: ${d.COUNTRY}\nCount: ${d.count}`);

    // Append the horizontal axis (EVENT TYPE)
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(fx).tickSizeOuter(0))
        .call(g => g.selectAll(".domain").remove());

    // 7. Append the vertical axis (COUNT)
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "s"))
        .call(g => g.selectAll(".domain").remove());

    // 8. --- NEW: Add a Legend ---
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - marginRight - 100}, ${marginTop})`);

    legend.selectAll("rect")
        .data(countries)
        .join("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", color);

    legend.selectAll("text")
        .data(countries)
        .join("text")
        .attr("x", 20)
        .attr("y", (d, i) => i * 20 + 12) // Vertically aligned to the middle
        .text(d => d)
        .attr("class", "legend-text"); // Use this class for styling    

}).catch(function(error) {
    console.error("Error loading Events_UK_RU.json:", error);
    d3.select("#uk-ru-chart-container") // Select the container to show the error
      .append("text")
      .text("Error: could not load data.");
});