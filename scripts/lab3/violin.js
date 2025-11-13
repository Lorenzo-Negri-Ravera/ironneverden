// File: violin_plot.js

// Load the json file
d3.json("../../data/lab3/UK_Distribution.json").then(function(data) {

    // Define the 3 categories of interest 
    const eventCategories = [
        "Air/drone strike", 
        "Shelling/artillery/missile attack", 
        "Remote explosive/landmine/IED"
    ];
    
    // Setting sizes and margins
    const width = 850;
    const height = 500;
    const marginTop = 60;
    const marginRight = 30;
    const marginBottom = 40;
    const marginLeft = 60; 

    // Building of the SVG container
    const svg = d3.select("#violin-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");
    
    // Add the title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Distribution of Population Exposure by Explosion Type in Ukraine");


    // Definition of the axes
    const yMax = d3.max(data, d => d.POPULATION_EXPOSURE);
    const y = d3.scaleLog() 
        .domain([1, yMax > 1 ? yMax : 10]) 
        .range([height - marginBottom, marginTop])
        .nice();

    const x = d3.scaleBand()
        .domain(eventCategories)
        .range([marginLeft, width - marginRight])
        .padding(0.1); 


    // Density Calculation 
    const histogram = d3.histogram()
        .value(d => d.POPULATION_EXPOSURE)
        .domain(y.domain()) 
        .thresholds(y.ticks(20)); 

    // Group data by category
    const groupedData = d3.group(data, d => d.SUB_EVENT_TYPE);

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

    // X-Density-Scale
    const overlapFactor = 1.3; 
    const xDensity = d3.scaleLinear()
        .domain([0, globalMaxDensity > 0 ? globalMaxDensity : 1])
        .range([0, (x.bandwidth() / 2) * overlapFactor]); 

    // Color scale
    const color = d3.scaleOrdinal()
        .domain(eventCategories)
        .range(["#002677", "#C8102E", "#F1C400"]); 


    // Buld violins
    const area = d3.area()
        .x0(d => -xDensity(d.length)) 
        .x1(d => xDensity(d.length))  
        .y(d => y((d.x0 + d.x1) / 2)) 
        .curve(d3.curveBasis); 

    const violinGroups = svg.append("g")
      .selectAll(".violin-group")
      .data(eventCategories)
      .join("g")
        .attr("class", "violin-group")
        .attr("transform", d => `translate(${x(d) + x.bandwidth() / 2}, 0)`);

    violinGroups.append("path")
        .attr("class", "violin-path")
        .attr("d", d => area(allBins.get(d)))
        .attr("fill", d => color(d))
        .attr("stroke", "#25282A")
        .attr("stroke-width", 1)
      .append("title")
        .text(d => d);
        
    // Add Boxplot Elements (Median and IQR) 
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

    const boxWidth = 13; // Width of the inner box 

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

    // Add Axis
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));
    
    // build grid lines for the Y-axis
    const powerOfTenTicks = [];
    let currentTickValue = 1;
    while (currentTickValue <= yMax) {
        powerOfTenTicks.push(currentTickValue);
        currentTickValue *= 10;
    }

    // Draw the grid lines 
    svg.append("g")
        .attr("class", "grid")
      .selectAll("line")
      .data(powerOfTenTicks) // Use the manually created array
      .join("line")
        .attr("x1", marginLeft) 
        .attr("x2", width - marginRight) 
        .attr("y1", d => y(d)) 
        .attr("y2", d => y(d)) 
        .attr("stroke", "#A4BCC2") 
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", "3,3"); 
    
    // Define the Y-axis
    const yAxis = d3.axisLeft(y)
        .tickValues(powerOfTenTicks)           // Force the axis to ONLY use these tick values
        .tickFormat(d3.format(".0s"));         // Format them as "1", "10", "100", "1k", "10k", "100k"

    // Add the y-axis
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(yAxis) // Call the customized axis 
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