// File: boxplot.js

// Load the json files
Promise.all([
    d3.json("../../data/lab3/BattlesUK.json"),
    d3.json("../../data/lab3/ExplosionsUK.json")
]).then(function([dataBattlesUK, dataExplosionsUK]) {

    // Helper function to compute boxplot statistics
    function computeBoxplotStats(data, type) {
        // Extract population exposure and sort them
        // UPDATED from d.FATALITIES to d.POPULATION_EXPOSURE
        const values = data.map(d => d.POPULATION_EXPOSURE).sort(d3.ascending);
        
        // Handle empty data case
        if (values.length === 0) {
            return { q1: 0, median: 0, q3: 0, iqr: 0, min: 0, max: 0, type: type };
        }

        // Calculate quartiles
        const q1 = d3.quantile(values, 0.25);
        const median = d3.quantile(values, 0.50);
        const q3 = d3.quantile(values, 0.75);
        const iqr = q3 - q1;
        
        // Find min and max values in the data
        const minVal = d3.min(values);
        const maxVal = d3.max(values);
        
        // Calculate whiskers using the 1.5 * IQR rule (Tukey's method)
        const lowerWhisker = Math.max(minVal, q1 - 1.5 * iqr);
        const upperWhisker = Math.min(maxVal, q3 + 1.5 * iqr);

        return {
            q1: q1,
            median: median,
            q3: q3,
            iqr: iqr,
            min: lowerWhisker,
            max: upperWhisker,
            type: type
        };
    }

    // Define the event types
    const eventTypes = ["Battles", "Explosions/Remote violence"];

    // Compute stats for both datasets
    const statsBattles = computeBoxplotStats(dataBattlesUK, eventTypes[0]);
    const statsExplosions = computeBoxplotStats(dataExplosionsUK, eventTypes[1]);
    const combinedStats = [statsBattles, statsExplosions];

    // Setting sizes and margins
    const width = 600; 
    const height = 500;
    const marginTop = 60;
    const marginRight = 180; // Increased margin for the legend
    const marginBottom = 30;
    const marginLeft = 60; 

    // Select an existing SVG container
    const svg = d3.select("#boxplot-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");
    
    // Add the title (uses .graph-title class from style.css)
    // UPDATED title text
    svg.append("text")
        .attr("x", width / 2 - marginRight / 2) 
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Distribution of Population Exposure by Event Type in Ukraine");

    // Definition of the axes
    // X scale (categorical for event types)
    const x = d3.scaleBand()
        .domain(eventTypes)
        .range([marginLeft, width - marginRight])
        .paddingInner(0.1)
        .paddingOuter(0.2);
    
    // Y scale (linear for population exposure count)
    const yMax = d3.max(combinedStats, d => d.max);
    const y = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]).nice() // Start from 0, handle all-zero data
        .range([height - marginBottom, marginTop]);

    // Set the color scale (using colors from other charts)
    const colorScale = d3.scaleOrdinal()
        .domain(eventTypes)
        .range(["#002677", "#C8102E"]); // Dark Blue, Red

    // Add the x-axis (styles will be applied via style.css)
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    // Add the y-axis (styles will be applied via style.css)
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "s")) // Using "s" for large numbers (e.g., 150k)
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", marginTop - 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            // UPDATED y-axis label
            .text("Population Exposure")); 

    // --- Building of the Boxplots ---

    // Define width of the boxes relative to the band
    const boxWidthRatio = 0.6;
    
    // Create a group for each boxplot
    const boxGroups = svg.selectAll(".box-group")
      .data(combinedStats)
      .join("g")
        .attr("class", "box-group")
        .attr("transform", d => `translate(${x(d.type)}, 0)`);

    // Center of the band
    const center = x.bandwidth() / 2;
    const boxWidth = x.bandwidth() * boxWidthRatio;
    
    // Main vertical whisker line (from min to max)
    boxGroups.append("line")
        .attr("x1", center)
        .attr("x2", center)
        .attr("y1", d => y(d.min))
        .attr("y2", d => y(d.max))
        .attr("stroke", "#25282A") 
        .attr("stroke-width", 1); 

    // Add the box (IQR)
    boxGroups.append("rect")
        .attr("x", center - boxWidth / 2)
        .attr("y", d => y(d.q3))
        .attr("width", boxWidth)
        .attr("height", d => Math.max(0, y(d.q1) - y(d.q3))) 
        .attr("fill", d => colorScale(d.type))
        .attr("stroke", "#25282A")
        .attr("stroke-width", 1)
        .style("opacity", 0.8)
      .append("title") // Add tooltip to the box
        // UPDATED tooltip text
        .text(d => `Event Type: ${d.type}\nMax Whisker: ${d.max.toFixed(0)}\nQ3: ${d.q3.toFixed(0)}\nMedian: ${d.median.toFixed(0)}\nQ1: ${d.q1.toFixed(0)}\nMin Whisker: ${d.min.toFixed(0)}`);

    // Add the median line
    boxGroups.append("line")
        .attr("x1", center - boxWidth / 2)
        .attr("x2", center + boxWidth / 2)
        .attr("y1", d => y(d.median))
        .attr("y2", d => y(d.median))
        .attr("stroke", "#FEDC97") // Yellow, for contrast
        .attr("stroke-width", 3);
        
    // Add top whisker horizontal line (cap)
    boxGroups.append("line")
        .attr("x1", center - boxWidth / 2)
        .attr("x2", center + boxWidth / 2)
        .attr("y1", d => y(d.max))
        .attr("y2", d => y(d.max))
        .attr("stroke", "#25282A")
        .attr("stroke-width", 1);

    // Add bottom whisker horizontal line (cap)
    boxGroups.append("line")
        .attr("x1", center - boxWidth / 2)
        .attr("x2", center + boxWidth / 2)
        .attr("y1", d => y(d.min))
        .attr("y2", d => y(d.min))
        .attr("stroke", "#25282A")
        .attr("stroke-width", 1);

    // Build the legend (uses .legend class from style.css)
    const legend = svg.append("g")
        .attr("class", "legend")
        // Position legend in the right margin
        .attr("transform", `translate(${width - marginRight + 20}, ${marginTop})`); 

    const legendGroups = legend.selectAll("g")
      .data(eventTypes)
      .join("g")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendGroups.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", d => colorScale(d)); 

    // The style.css file targets ".legend text"
    legendGroups.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .text(d => d);

}).catch(function(error) {
    console.error("Error loading JSON files:", error);
    d3.select("#boxplot-container") 
      .append("h2")
      .style("color", "red")
      // Kept file names as they are the same
      .text("Error: could not load data. Make sure 'BattlesUK.json' and 'ExplosionsUK.json' are present.");
});