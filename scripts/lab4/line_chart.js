// File: TimeSeries_Events_Chart.js

d3.json("../../data/lab4/TimeSeries_Explosion_UKR.json").then(function(data) {
    
    data.forEach(d => {
        d.date = new Date(+d.WEEK); 
        d.value = +d.EVENTS; 
        d.division = d.SUB_EVENT_TYPE; 
    });
    
    // Margins and sizes
    const width = 928;
    const height = 600;
    const marginTop = 60;
    const marginRight = 250; 
    const marginBottom = 50; 
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
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        //.text("TITLE TODO");


    // Line generation
    const line = d3.line()
        .defined(d => !isNaN(d.value))
        .x(d => x(d.date))
        .y(d => y(d.value));

    
    // Draw the chart
    const path = svg.append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
      .selectAll("path")
      .data(groups) 
      .join("path")
        .style("mix-blend-mode", "multiply")
        .attr("stroke", ([key]) => color(key)) 
        .attr("d", ([, values]) => line(values));


    // Add x-axes
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x)
            .ticks(d3.timeMonth.every(6)) // Ticks for each 6 months
            .tickFormat(d3.timeFormat("%b %Y"))
            .tickSizeOuter(0))
        .selectAll("text")
          .attr("y", 10) 
          .attr("x", -5)
          .attr("dy", ".35em")
          .attr("transform", "rotate(-45)") 
          .style("text-anchor", "end");

    // Add y-axes
    const yAxisGroup = svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "f")) 
        .call(g => g.select(".domain").remove());
        
    yAxisGroup.append("text")
        .attr("x", -marginLeft)
        .attr("y", 10)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        //.text("Events count");


    // Build the legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width - marginRight + 20}, ${marginTop})`);

    const legendGroups = legend.selectAll("g")
      .data(keys)
      .join("g")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendGroups.append("rect")
        .attr("width", 15)
        .attr("height", 3)
        .attr("y", 4) 
        .attr("fill", d => color(d)); 

    legendGroups.append("text")
        .attr("x", 20)
        .attr("y", 12) 
        .text(d => d);


    //Interactive part
    const points = data.map((d) => [x(d.date), y(d.value), d.division, d.date, d.value]);
    const tooltipDateFormat = d3.timeFormat("%b %Y"); 

    const dot = svg.append("g")
        .attr("display", "none");

    dot.append("circle")
        .attr("r", 2.5)
        .attr("fill", "black"); 

    dot.append("text")
        .attr("text-anchor", "middle")
        .attr("y", -8)
        .attr("fill", "black");

    svg
        .on("pointerenter", pointerentered)
        .on("pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    function pointermoved(event) {
        const [xm, ym] = d3.pointer(event);
        
        const i = d3.leastIndex(points, ([x, y]) => Math.hypot(x - xm, y - ym));
        
        const [px, py, k, date, value] = points[i]; 
        
        // Highlights the line
        path.style("stroke", ([key]) => key === k ? color(k) : "#ddd") 
            .filter(([key]) => key === k).raise();
        
        // Update the tooltip
        dot.attr("transform", `translate(${px},${py})`);
        dot.select("text").text(`${k}: ${Math.round(value)} (${tooltipDateFormat(date)})`);
        
        dot.attr("display", null);
    }

    function pointerentered() {
        path.style("mix-blend-mode", null).style("stroke", "#ddd"); 
        dot.attr("display", null);
    }

    function pointerleft() {
        path.style("mix-blend-mode", "multiply").style("stroke", ([key]) => color(key)); 
        dot.attr("display", "none");
    }

}).catch(function(error) {
    console.error("Errore nel caricamento del file JSON:", error);
    d3.select("#line-chart-container") 
      .append("text")
      .text("Errore: impossibile caricare i dati.");
});