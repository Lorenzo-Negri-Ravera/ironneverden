// File: TimeSeries_Events_Chart.js

d3.json("../../data/lab4/TimeSeries_Explosion_UKR.json").then(function(data) {
    
    data.forEach(d => {
        d.date = new Date(+d.WEEK); 
        d.value = +d.EVENTS; 
        d.division = d.SUB_EVENT_TYPE; 
    });
    
    // Sort data by date
    data.sort((a, b) => a.date - b.date);

    // Margins and sizes
    const width = 1000;
    const height = 600;
    const marginTop = 60;
    const marginRight = 50; 
    const marginBottom = 100; 
    const marginLeft = 50; 

    const keys = [...new Set(data.map(d => d.division))].sort(d3.ascending);
    const groups = d3.group(data, d => d.division);

    // Definition of the axis
    const x = d3.scaleUtc() 
        .domain(d3.extent(data, d => d.date))
        .range([marginLeft, width - marginRight]);

    const y = d3.scaleLinear() 
        .domain([0, d3.max(data, d => d.value)]).nice()
        .range([height - marginBottom, marginTop]);

    
    // Colors of the lines
    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(["#002677", "#F1C400", "#C8102E"]);


    // Build the SVG container
    const svg = d3.select("#line-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto");
    
    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 3)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Evolution of the Main Assault Tactics on Ukrainian Territory"); 

    // Line generation function
    const line = d3.line()
        .defined(d => !isNaN(d.value))
        .x(d => x(d.date))
        .y(d => y(d.value));

    // Definition of a rectangular clip path that will act as a curtain.
    // Initially, it has width 0 (everything hidden).
    const clip = svg.append("defs").append("clipPath")
        .attr("id", "chart-clip")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0) // Start hidden
        .attr("height", height);

    // Draw the chart lines
    const paths = svg.append("g") 
        .attr("fill", "none")
        .attr("stroke-width", 2.5) 
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("clip-path", "url(#chart-clip)") 
      .selectAll(".line-path") 
      .data(groups) 
      .join("path")
        .attr("class", "line-path") 
        .style("mix-blend-mode", "multiply")
        .attr("stroke", ([key]) => color(key)) 
        .attr("d", ([, values]) => line(values));



    // Animation and Reset Functions 

    // Function to prepare and hide (Reset)
    function resetLines() {
        // Interrupts any active transitions
        clip.interrupt(); 
        // Reset the width of the clip rectangle to 0
        clip.attr("width", 0);
    }

    // Function to start the drawing animation
    function startDrawingAnimation() {
        // Run reset first for safety
        resetLines(); 
        
        // Animation of the width of the clip rectangle from 0 to the full width.
        // This reveals the chart from left to right, perfectly synchronized on the X-axis.
        clip.transition()
            .duration(5000) 
            .ease(d3.easeLinear)
            .attr("width", width); 
    }

    // Observer for animation
    const chartContainerElement = document.querySelector("#line-chart-container");
    
    if (chartContainerElement && 'IntersectionObserver' in window) {
        
        // Hide lines initially
        setTimeout(resetLines, 50);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                
                // Entering the viewport: Start animation
                if (entry.isIntersecting) {
                    setTimeout(startDrawingAnimation, 300); 
                } 
                // Leaving the viewport: Reset the line
                else {
                    setTimeout(resetLines, 50); 
                }
            });
        }, {
            // Threshold for triggering (50% visibility)
            threshold: 0.5 
        });
        
        // Start observing
        observer.observe(chartContainerElement);

    } else {
        console.warn("IntersectionObserver not supported or container not found. Forcing animation start.");
        setTimeout(startDrawingAnimation, 100); 
    }


    // Add x-axes
    const xAxisGroup = svg.append("g") // Salvato il gruppo dell'asse X
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x)
            .ticks(d3.timeMonth.every(6)) 
            .tickFormat(d3.timeFormat("%b %Y"))
            .tickSizeOuter(0));
            
    const xAxisLabels = xAxisGroup.selectAll("text")
          .attr("y", 10) 
          .attr("x", -5)
          .attr("dy", ".35em")
          .attr("transform", "rotate(-45)") 
          .style("text-anchor", "end");


    // Add y-axes
    const yAxisGroup = svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "f")
            .tickSize(-(width - marginLeft - marginRight)) 
            .tickSizeOuter(0)
            .tickFormat(d => d === 0 ? "" : d) 
        ) 
        .call(g => g.select(".domain").remove()) 
        .call(g => g.selectAll(".tick line") 
            .attr("stroke", "#A4BCC2")
            .attr("stroke-width", 1.2)
            .attr("stroke-dasharray", "3,3"));
        
    yAxisGroup.append("text")
        .attr("x", -marginLeft + 10) 
        .attr("y", marginTop - 20) 
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .text("Number of Events"); 


    // Fixed margin between the end of a text label and the next square
    const legendPadding = 50; 
    
    // Position the legend below the X axis
    const legendY = height - marginBottom + 80; 

    // Build the legend container 
    const legendContainer = svg.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(0, ${legendY})`);

    // Create groups with rectangles (lines) and text
    const legendGroups = legendContainer.selectAll("g")
      .data(keys)
      .join("g")
        .attr("class", "legend-item");
        
    legendGroups.append("rect")
        .attr("width", 15)
        .attr("height", 3)
        .attr("y", 4) 
        .attr("fill", d => color(d)); 

    legendGroups.append("text")
        .attr("x", 20) 
        .attr("y", 12) 
        .text(d => d)
        .attr("class", "legend-text");
        
        
    // Measure the width of each group and calculate positions
    let currentX = 0;
    let totalLegendWidth = 0;
    
    // Change the position of the legend items
    legendGroups.each(function() {
        const itemWidth = this.getBBox().width; 
        d3.select(this).attr("transform", `translate(${currentX}, 0)`);
        currentX += itemWidth + legendPadding;
    });

    totalLegendWidth = currentX - legendPadding;

    // Center the entire container
    const legendX = (width - totalLegendWidth) / 2;
    legendContainer.attr("transform", `translate(${legendX}, ${legendY})`);


    // Interactive part 
    const points = data.map((d) => [x(d.date), y(d.value), d.division, d.date, d.value]);
    //const tooltipDateFormat = d3.timeFormat("%d %b %Y");  // Not used

    const trackerLine = svg.append("line")
        .attr("class", "tracker-line")
        .attr("stroke", "#555")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4") 
        .attr("display", "none"); 

    const dot = svg.append("g")
        .attr("display", "none");

    dot.append("circle")
        .attr("r", 2.5)
        .attr("fill", "black"); 
    
    dot.append("text")  
        .attr("text-anchor", "middle")
        .attr("y", -8)
        .attr("fill", "black")
        .attr("font-weight", "bold");
        
    const dateLabel = svg.append("text")
        .attr("class", "date-label-x")
        .attr("text-anchor", "middle")
        .attr("y", height - marginBottom + 40) 
        .attr("fill", "black")
        .attr("font-weight", "bold")
        .attr("display", "none");

    svg
        .on("pointerenter", pointerentered)
        .on("pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    function pointermoved(event) {
        const [xm, ym] = d3.pointer(event);
        
        const i = d3.leastIndex(points, ([xCoord, yCoord]) => Math.hypot(xCoord - xm, yCoord - ym));
        
        const [px, py, k, date, value] = points[i]; 

        // Pick the color for the series
        const seriesColor = color(k); 
        paths.style("stroke", ([key]) => key === k ? seriesColor : "#ddd") 
            .filter(([key]) => key === k).raise();
        
        // Apply opacity to the "selected line"
        legendGroups.style("opacity", d => d === k ? 1 : 0.3); 
        
        // Update position and text of the dot
        dot.attr("transform", `translate(${px},${py})`);
        dot.select("text").text(`${Math.round(value)}`);      // Visualize only the value
        dot.attr("display", null);

        // Update tracker line and date label
        trackerLine
            .attr("x1", px)
            .attr("x2", px)
            .attr("y1", py) 
            .attr("y2", height - marginBottom) 
            .attr("stroke", seriesColor)
            .attr("display", null);
            
        dateLabel
            .attr("x", px)
            .text(d3.timeFormat("%d %b %Y")(date)) 
            .attr("fill", "#000000ff")
            .attr("display", null);
        
        // Hide the x-axis labels
        xAxisLabels.attr("display", "none");
    }

    function pointerentered() {
        paths.style("mix-blend-mode", null).style("stroke", "#ddd"); 
        dot.attr("display", null);

        // Show tracker line and date label
        trackerLine.attr("display", null);
        dateLabel.attr("display", null);

        legendGroups.style("opacity", 0.3);   
        
        // Hide the x-axis labels
        xAxisLabels.attr("display", "none");
    }

    function pointerleft() {
        paths.style("mix-blend-mode", "multiply").style("stroke", ([key]) => color(key)); 
        dot.attr("display", "none");

        // Hide tracker line and date label
        trackerLine.attr("display", "none");
        dateLabel.attr("display", "none");

        // Reset legend opacity
        legendGroups.style("opacity", 1);  
        
        // Show the x-axis labels
        xAxisLabels.attr("display", null);
    }

}).catch(function(error) {
    console.error("Error loading JSON file:", error);
    d3.select("#line-chart-container") 
      .append("text")
      .text("Error: unable to load data. Check console for details.");
});