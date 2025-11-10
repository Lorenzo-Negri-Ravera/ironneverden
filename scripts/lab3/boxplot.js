// File: boxplot.js

// Load the json files
Promise.all([
    d3.json("../../data/lab3/BattlesUK.json"),
    d3.json("../../data/lab3/ExplosionsUK.json")
]).then(function([dataBattlesUK, dataExplosionsUK]) {

    // Function to compute boxplot statistics
    function computeBoxplotStats(data, type) {
        
        // Extract population exposure and sort them
        const values = data.map(d => d.POPULATION_EXPOSURE).sort(d3.ascending);

        // Calculate quartiles
        const q1 = d3.quantile(values, 0.25);
        const median = d3.quantile(values, 0.50);
        const q3 = d3.quantile(values, 0.75);
        const iqr = q3 - q1;
        
        // Find min and max values
        const minVal = d3.min(values);
        const maxVal = d3.max(values);
        
        // Calculate whiskers 
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
    const eventTypes = ["Battles", "Explosions"];

    // Compute stats for both datasets
    const statsBattles = computeBoxplotStats(dataBattlesUK, eventTypes[0]);
    const statsExplosions = computeBoxplotStats(dataExplosionsUK, eventTypes[1]);
    const combinedStats = [statsBattles, statsExplosions];

    // Setting sizes and margins
    const width = 600;
    const height = 500;
    const marginTop = 60;
    const marginRight = 30;
    const marginBottom = 30;
    const marginLeft = 60;

    // Building of the SVG container
    const svg = d3.select("#boxplot-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");
    
    // Add the title
    svg.append("text")
        .attr("x", width / 2) 
        .attr("y", marginTop / 3)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Comparing Population Exposure from Battles and Explosions in Ukraine since 2022");

    // Definition of the axes
    const x = d3.scaleBand()
        .domain(eventTypes)
        .range([marginLeft, width - marginRight])
        .paddingInner(0.1)
        .paddingOuter(0.2);
    
    const yMax = d3.max(combinedStats, d => d.max);
    const y = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]).nice() 
        .range([height - marginBottom, marginTop]);

    // Color scale for the boxes 
    const colorScale = d3.scaleOrdinal()
        .domain(eventTypes)
        .range(["#002677", "#C8102E"]); 

    // Add the axis
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    // Add the y-axis
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "s")) 
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", marginTop - 20)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("Population Exposure")); 

    
    
    // Building of the Boxplots 

    // Define width of the boxes 
    const boxWidthRatio = 0.5;
    
    // Create a group for each boxplot
    const boxGroups = svg.selectAll(".box-group")
      .data(combinedStats)
      .join("g")
        .attr("class", "box-group")
        .attr("transform", d => `translate(${x(d.type)}, 0)`);

    // Center of the band
    const center = x.bandwidth() / 2;
    const boxWidth = x.bandwidth() * boxWidthRatio;
    
    // Main vertical whisker line
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
      .append("title") 
        .text(d => `Event Type: ${d.type}\nMax Whisker: ${d.max.toFixed(0)}\nQ3: ${d.q3.toFixed(0)}\nMedian: ${d.median.toFixed(0)}\nQ1: ${d.q1.toFixed(0)}\nMin Whisker: ${d.min.toFixed(0)}`);

    // Add the median line
    boxGroups.append("line")
        .attr("x1", center - boxWidth / 2)
        .attr("x2", center + boxWidth / 2)
        .attr("y1", d => y(d.median))
        .attr("y2", d => y(d.median))
        .attr("stroke", "#FEDC97") // Yellow, for contrast
        .attr("stroke-width", 3);
        
    // Add the whiskers 
    boxGroups.append("line")
        .attr("x1", center - boxWidth / 2)
        .attr("x2", center + boxWidth / 2)
        .attr("y1", d => y(d.max))
        .attr("y2", d => y(d.max))
        .attr("stroke", "#25282A")
        .attr("stroke-width", 1);

    boxGroups.append("line")
        .attr("x1", center - boxWidth / 2)
        .attr("x2", center + boxWidth / 2)
        .attr("y1", d => y(d.min))
        .attr("y2", d => y(d.min))
        .attr("stroke", "#25282A")
        .attr("stroke-width", 1);

}).catch(function(error) {
    console.error("Error loading JSON files:", error);
    d3.select("#boxplot-container") 
      .append("h2")
      .style("color", "red")
      .text("Error: could not load data. Make sure 'BattlesUK.json' and 'ExplosionsUK.json' are present.");
});