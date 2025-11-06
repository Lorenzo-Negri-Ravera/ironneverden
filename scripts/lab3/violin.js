// File: violin_plot.js

// Load the json file
d3.json("../../data/lab3/UK_Distribution.json").then(function(data) {

    // --- 1. Data Preparation ---

    // Define the 3 categories of interest based on SUB_EVENT_TYPE
    const eventCategories = [
        "Air/drone strike", 
        "Shelling/artillery/missile attack", 
        "Remote explosive/landmine/IED"
    ];
    
    // Filter data to only include the 3 categories
    // AND filter out values <= 0 for the log scale
    const filteredData = data.filter(d => 
        eventCategories.includes(d.SUB_EVENT_TYPE) && +d.POPULATION_EXPOSURE > 0
    );

    // Ensure POPULATION_EXPOSURE is numeric
    filteredData.forEach(d => {
        d.POPULATION_EXPOSURE = +d.POPULATION_EXPOSURE;
    });

    // --- 2. Setup SVG and Margins ---
    const width = 850;
    const height = 500;
    const marginTop = 60;
    const marginRight = 30;
    const marginBottom = 40;
    const marginLeft = 60; 

    // Select the existing SVG container
    const svg = d3.select("#violin-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");
    
    // Add the title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2.5)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Distribution of Population Exposure (Log Scale) by Attack Type in Ukraine");

    // --- 3. Define Scales ---

    // Y-axis scale (Logarithmic for population exposure)
    const yMax = d3.max(filteredData, d => d.POPULATION_EXPOSURE);
    const y = d3.scaleLog() 
        .domain([1, yMax > 1 ? yMax : 10]) 
        .range([height - marginBottom, marginTop])
        .nice();

    // X-axis scale (Band for the 3 categories)
    const x = d3.scaleBand()
        .domain(eventCategories)
        .range([marginLeft, width - marginRight])
        .padding(0.1); 

    // --- 4. Density Calculation (Histogram) ---
    
    // Create a histogram generator for the Y-axis
    const histogram = d3.histogram()
        .value(d => d.POPULATION_EXPOSURE)
        .domain(y.domain()) 
        .thresholds(y.ticks(20)); 

    // Group data by category
    const groupedData = d3.group(filteredData, d => d.SUB_EVENT_TYPE);

    // Calculate bins and find the global maximum density
    let globalMaxDensity = 0;
    const allBins = new Map();

    eventCategories.forEach(cat => {
        const dataForCat = groupedData.get(cat) || [];
        const bins = histogram(dataForCat);
        allBins.set(cat, bins);
        
        const catMaxDensity = d3.max(bins, d => d.length);
        if (catMaxDensity > globalMaxDensity) {
            globalMaxDensity = catMaxDensity;
        }
    });

    // X-Density-Scale (for the width of the violin)
    // Domain is global to ensure comparability
    const overlapFactor = 1.4; // Controls how much the violin extends beyond half the band width
    const xDensity = d3.scaleLinear()
        .domain([0, globalMaxDensity > 0 ? globalMaxDensity : 1])
        .range([0, (x.bandwidth() / 2) * overlapFactor]); // Max width now scaled by overlapFactor

    // Color scale
    const color = d3.scaleOrdinal()
        .domain(eventCategories)
        .range(["#002677", "#C8102E", "#FEDC97"]); // Blue, Red, Yellow

    // --- 5. Draw the Violins ---
    
    // Area generator for the violin shape
    const area = d3.area()
        .x0(d => -xDensity(d.length)) 
        .x1(d => xDensity(d.length))  
        .y(d => y((d.x0 + d.x1) / 2)) 
        .curve(d3.curveBasis); 

    // Create a group for each violin
    const violinGroups = svg.append("g")
      .selectAll(".violin-group")
      .data(eventCategories)
      .join("g")
        .attr("class", "violin-group")
        .attr("transform", d => `translate(${x(d) + x.bandwidth() / 2}, 0)`);

    // Draw the violin path
    violinGroups.append("path")
        .attr("class", "violin-path")
        .attr("d", d => area(allBins.get(d)))
        .attr("fill", d => color(d))
        .style("fill-opacity", 0.7)
        .attr("stroke", "#25282A")
        .attr("stroke-width", 1)
      .append("title")
        .text(d => d);
        
    // --- 6. Add Boxplot Elements (Median and IQR) ---
    
    // Helper function
    function computeStats(data) {
        const values = data.map(d => d.POPULATION_EXPOSURE).sort(d3.ascending);
        if (values.length === 0) return { q1: 1, median: 1, q3: 1 };
        
        const q1 = d3.quantile(values, 0.25);
        const median = d3.quantile(values, 0.50);
        const q3 = d3.quantile(values, 0.75);
        
        return {
            q1: q1 > 0 ? q1 : 1, 
            median: median > 0 ? median : 1, 
            q3: q3 > 0 ? q3 : 1 
        };
    }

    const boxWidth = 15; // Width of the inner box (can be adjusted if needed)

    // Draw IQR box
    violinGroups.append("rect")
        .attr("x", -boxWidth / 2)
        .attr("y", d => y(computeStats(groupedData.get(d) || []).q3))
        .attr("height", d => {
            const stats = computeStats(groupedData.get(d) || []);
            return Math.max(0, y(stats.q1) - y(stats.q3));
        })
        .attr("width", boxWidth)
        .attr("fill", "white")
        .attr("stroke", "#25282A")
        .attr("stroke-width", 1.5)
        .style("opacity", 0.8);

    // Draw median line
    violinGroups.append("line")
        .attr("x1", -boxWidth / 2)
        .attr("x2", boxWidth / 2)
        .attr("y1", d => y(computeStats(groupedData.get(d) || []).median))
        .attr("y2", d => y(computeStats(groupedData.get(d) || []).median))
        .attr("stroke", "#25282A")
        .attr("stroke-width", 2);

    // --- 7. Draw Axes ---
    
    // Add the x-axis
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    // --- UPDATED: Y-axis Grid Lines & Labels ---
    
    // Manually create an array of powers of 10
    const powerOfTenTicks = [];
    let currentTickValue = 1;
    // yMax was defined in Section 3
    while (currentTickValue <= yMax) {
        powerOfTenTicks.push(currentTickValue);
        currentTickValue *= 10;
    }

    // Draw the grid lines using this array
    svg.append("g")
        .attr("class", "grid")
      .selectAll("line")
      .data(powerOfTenTicks) // Use the manually created array
      .join("line")
        .attr("x1", marginLeft) // Start at the left axis
        .attr("x2", width - marginRight) // End at the right margin
        .attr("y1", d => y(d)) // Y position based on data
        .attr("y2", d => y(d)) // Y position based on data
        .attr("stroke", "#D9D9D6") // A light grey color
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3"); // Make it dashed
    
    // Define the Y-axis
    const yAxis = d3.axisLeft(y)
        // Force the axis to ONLY use these tick values
        .tickValues(powerOfTenTicks) 
        // Format them as "1", "10", "100", "1k", "10k", "100k"
        .tickFormat(d3.format(".0s")); 

    // Add the y-axis
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis) // Call the customized axis
        // Remove the solid black axis line
        .call(g => g.selectAll(".domain").remove()) 
        // Remove the small tick marks (we have the grid lines now)
        .call(g => g.selectAll(".tick line").remove()) 
        // Add the axis title
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", marginTop - 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("Population Exposure (Log Scale)")); 

}).catch(function(error) {
    console.error("Error loading ../../data/lab3/UK_Distribution.json:", error);
    d3.select("#violin-container")
      .append("h2")
      .style("color", "red")
      .text("Error: could not load data. Make sure 'UK_distribution.json' is present.");
});