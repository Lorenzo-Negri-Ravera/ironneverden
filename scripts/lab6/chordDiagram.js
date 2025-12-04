// File: chordDiagram.js

const CHORD_PATH = '../../data/lab6/chord_data_ukraine_events.json'; 

d3.json(CHORD_PATH).then(function(data) {

    // Definitions of dimensions
    const width = 1100; 
    const height = 950; 
    const innerRadius = 250;
    const outerRadius = 260;

    // Build the SVG container
    const svg = d3.select("#chord-container")
        .attr("viewBox", [-width / 2, -height / 2, width, height]) 
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; font: 12px sans-serif;");

    // Add title
    svg.append("text")
        .attr("x", 0)             
        .attr("y", -height / 2 + 90) 
        .attr("text-anchor", "middle")
        .attr("class", "graph-title")
        .text("Relations between Events and Ukraine regions"); 

    const rotationAngle = -60; 

    // Conversion in radians
    const rotationRad = rotationAngle * Math.PI / 180;

    // Group for the diagram 
    const chartGroup = svg.append("g")
        .attr("transform", `translate(-150, -50) rotate(${rotationAngle})`);

    // Group for the panel (right side)
    const infoGroup = svg.append("g")
        .attr("transform", "translate(180, -300)");

    // Definition of the panel
    const infoBg = infoGroup.append("rect")
        .attr("width", 300)
        .attr("height", 0)
        .attr("fill", "#f9f9f9")
        .attr("stroke", "#ccc")
        .attr("rx", 10) 
        .attr("opacity", 0); 

    // Text container inside the panel
    const infoText = infoGroup.append("text")
        .attr("font-family", "sans-serif")
        .attr("font-size", "14px");

    // Recovering data from the JSON
    const matrix = data.matrix;
    const names = data.names;    
    const numEventTypes = data.meta.num_event_types; 

    // Layout Chord
    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending)
        (matrix);

    // Color scale
    const color = d3.scaleOrdinal()
        .domain(names)
        .range(names.map((d, i) => {
            if (i < numEventTypes) return d3.schemeCategory10[i % 10]; 
            return "#404040ff"; 
        }));

    
    // Ribbons - inside connections
    const ribbons = chartGroup.append("g")
        .attr("fill-opacity", 0.7)
        .selectAll("path")
        .data(chord)
        .join("path")
        .attr("d", d3.ribbon().radius(innerRadius))
        .attr("fill", d => color(names[d.source.index])) 
        .attr("stroke", d => d3.rgb(color(names[d.source.index])).darker());

    // Group - outer arcs
    const group = chartGroup.append("g")
        .selectAll("g")
        .data(chord.groups)
        .join("g");

    group.append("path")
        .attr("fill", d => color(names[d.index]))
        .attr("stroke", d => d3.rgb(color(names[d.index])).darker())
        .attr("d", d3.arc().innerRadius(innerRadius).outerRadius(outerRadius));

    // Labels 
    group.append("text")
        .each(d => { 
            d.angle = (d.startAngle + d.endAngle) / 2; 
        })
        .attr("dy", ".35em")
        .attr("transform", d => {
            let str = `rotate(${(d.angle * 180 / Math.PI - 90)}) translate(${outerRadius + 10})`;            
            let visualAngle = d.angle + rotationRad;            
            visualAngle = visualAngle % (2 * Math.PI);
            if (visualAngle < 0) visualAngle += 2 * Math.PI;
            if (visualAngle > Math.PI) {
                str += " rotate(180)";
            }
            return str;
        })
        .attr("text-anchor", d => {
            let visualAngle = d.angle + rotationRad;
            visualAngle = visualAngle % (2 * Math.PI);
            if (visualAngle < 0) visualAngle += 2 * Math.PI;
            
            return visualAngle > Math.PI ? "end" : "start";
        })
        .text(d => names[d.index])
        .style("font-weight", "bold");


    // Interaction part
    
    // Draw the panel
    function updateInfoPanel(d) {
        infoText.selectAll("*").remove();
        infoBg.attr("opacity", 1);        

        // Compute connections
        let connections = [];
        chord.forEach(c => {
            if (c.source.index === d.index && c.source.value > 0) {
                connections.push({ name: names[c.target.index], value: c.source.value });
            } else if (c.target.index === d.index && c.source.value > 0) {
                connections.push({ name: names[c.source.index], value: c.source.value });
            }
        });
        connections.sort((a, b) => b.value - a.value);


        // Title inside tooltip
        infoText.append("tspan")
            .attr("x", 15)
            .attr("y", 30) 
            .attr("font-weight", "bold")
            .attr("font-size", "18px")
            .attr("fill", color(names[d.index]))
            .text(names[d.index]);

        // List of connections
        const maxItems = 20; 
        
        connections.slice(0, maxItems).forEach((c, i) => {
            // Label text
            infoText.append("tspan")
                .attr("x", 15)
                .attr("dy", i === 0 ? "2.5em" : "1.2em") 
                .attr("font-weight", "normal")
                .attr("font-size", "14px")
                .attr("fill", "#000")
                .text(c.name);

            // Label value
            infoText.append("tspan")
                .attr("x", 250) 
                .attr("font-weight", "bold")
                .text(c.value);
        });

        // Adactive resize of the panel 
        const bBox = infoText.node().getBBox();        
        const paddingBottom = 20;
        const dynamicHeight = bBox.y + bBox.height + paddingBottom;
        infoBg.attr("height", dynamicHeight);
    }

    // Mouseover and mouseout events
    group
        .on("mouseover", function(event, d) {
            ribbons.transition().duration(200)
                .style("opacity", ribbon => 
                    (ribbon.source.index === d.index || ribbon.target.index === d.index) ? 0.7 : 0.05
                );
            updateInfoPanel(d);
        })
        .on("mouseout", function() {
            ribbons.transition().duration(200).style("opacity", 0.7);            
            infoBg.attr("opacity", 0);
            infoText.selectAll("*").remove();
        });

}).catch(err => console.error("Errore caricamento JSON:", err));