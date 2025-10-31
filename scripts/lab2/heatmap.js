// File: heatmap.js

const margin = { top: 30, right: 30, bottom: 50, left: 150 };
const width = 500 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

const svg = d3.select("#heatmap-container")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

// -------------------------------------------------------------------
// NOTE: Make sure this path is correct
// RELATIVE TO THE HTML FILE THAT LOADS THE SCRIPT
// -------------------------------------------------------------------
d3.json("../../data/lab2/top15_countries_by_year.json").then(function(data) {
    
    const allCountries = [];
    const countrySet = new Set();
    for (const d of data) {
        if (!countrySet.has(d.COUNTRY)) {
                countrySet.add(d.COUNTRY);
                allCountries.push(d.COUNTRY);
            }
        }

    const allYears = [...new Set(data.map(d => d.YEAR))].sort(d3.ascending);
    const maxCount = d3.max(data, d => d.count);

    const xScale = d3.scaleBand()
        .domain(allYears)
        .range([0, width])
        .padding(0.05);

    const yScale = d3.scaleBand()
        .domain(allCountries)
        .range([0,height])
        .padding(0.05);

    const colorScale = d3.scaleLinear()
        .domain([0, maxCount])
        .range(["#fef0d9", "#b10026"]); 

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale));

    svg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale));

    svg.selectAll(".cell")
        .data(data)
        .join("rect")
            .attr("class", "cell")
            .attr("x", d => xScale(d.YEAR))
            .attr("y", d => yScale(d.COUNTRY))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("fill", d => colorScale(d.count))
        .append("title")
            // Tooltip text translated
            .text(d => `Country: ${d.COUNTRY}\nYear: ${d.YEAR}\nCount: ${d.count}`);

}).catch(function(error) {
    // Error message translated and filename updated
    console.error("Error loading ../../data/lab2/top20_countries_by_year.json:", error);
    // Fallback text translated
    svg.append("text").text("Error: could not load data.");
});