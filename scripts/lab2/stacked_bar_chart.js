// File: stacked_bar_chart.js

// Load the json file
d3.json("../../data/lab2/Year_Events_UKR.json").then(function(data) {
    
    // Set sizes and margins
    const width = 1000;
    const height = 600;
    const marginTop = 60;
    const marginRight = 50; 
    const marginBottom = 70;
    const marginLeft = 50;

    // Extraction of the data to build the stacked barchart
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
    wideData.sort((a, b) => d3.ascending(a.YEAR, b.YEAR));     // sorting by year

    // Stack generator 
    const series = d3.stack()
        .keys(keys)
        .offset(d3.stackOffsetExpand) // This to create a 100% stacked chart
        .value((d, key) => d[key])
        (wideData);

    // Definition of the axes
    const x = d3.scaleBand()
        .domain(wideData.map(d => d.YEAR))
        .range([marginLeft, width - marginRight])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, 1]) // (0% to 100%)
        .range([height - marginBottom, marginTop]);

    
    // Set the color
    const color = d3.scaleOrdinal()
        .domain(keys)
        .range(["#002677", "#C8102E", "#F1C400", "#D9D9D6", "#25282A"]); // Dark Blue, Orange, Red, Yellow, Green


    // Select the existing SVG container
    const svg = d3.select("#stacked-bar-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");
    
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Normalized visualization of types of civil unrest and violence events in Ukraine since 2017");

    
        // Building of the stacked barchart
    
    // Create groups for each series
    const groups = svg.append("g")
      .selectAll()
      .data(series)
      .join("g");
        
    // Create the rects 
    const rects = groups.selectAll("rect")
      .data(D => D.map(d => (d.key = D.key, d))) 
      .join("rect")
        .attr("fill", d => color(d.key)) 
        .attr("x", d => x(d.data.YEAR))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .style("transition", "opacity 0.7s ease-in-out"); 
    
    // Add the interaction with the rects
    rects.append("title")
      .text(d => {
          const originalData = d.data;
          const eventType = d.key;
          const count = originalData[eventType];
          let total = 0;
          keys.forEach(key => { total += originalData[key]; });
          const percent = (count / total * 100).toFixed(1);
          return `${originalData.YEAR} - ${eventType}\nCount: ${count} (${percent}%)`;
        });

    // Action for the interaction
    rects.on("mouseover", function(event, d) {
        rects.style("opacity", 0.3); 
        d3.select(this).style("opacity", 1);
    }).on("mouseout", function(event, d) {        
        rects.style("opacity", 1);
    });

    // Add the x-axis (year)
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).tickSizeOuter(0));

    // Add the y-axis (percentage)
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y).ticks(null, "%")) // Format as percentage
        .call(g => g.selectAll(".domain").remove());
        

    // --- MODIFICATO: Legenda Orizzontale Dinamica e Robusta in Basso al Centro ---
    
    // Margine fisso che vuoi tra la fine di una label testuale e l'inizio del prossimo quadratino
    const legendPadding = 40; 
    
    // Posiziona la legenda 50px sotto la linea dell'asse x
    const legendY = height - marginBottom + 50; 

    // Build the legend container (inizialmente posizionato a sinistra per calcolare le larghezze)
    const legendContainer = svg.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(0, ${legendY})`);


    // 1. Crea i gruppi con rettangoli e testo
    const legendGroups = legendContainer.selectAll("g")
      .data(keys)
      .join("g")
        .attr("class", "legend-item");
        
    legendGroups.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", d => color(d)); 

    const legendText = legendGroups.append("text")
        .attr("x", 20) // 5px di margine dopo il quadratino di 15px
        .attr("y", 12) 
        .text(d => d)
        .attr("class", "legend-text");
        
        
    // 2. Misura la larghezza di ciascun gruppo e calcola le posizioni
    let currentX = 0;
    let totalLegendWidth = 0;
    
    // Usa .each() per misurare dopo che il testo è stato aggiunto
    legendGroups.each(function() {
        // Misura l'intera larghezza del gruppo (rect + text)
        const itemWidth = this.getBBox().width; 
        
        // Applica la traslazione (posizionamento X)
        d3.select(this).attr("transform", `translate(${currentX}, 0)`);
        
        // Aggiorna la posizione per l'elemento successivo (+ padding)
        currentX += itemWidth + legendPadding;
    });

    // La larghezza totale è l'ultimo punto di partenza (currentX) meno l'ultimo padding non necessario
    // Poiché currentX è stato aggiornato dopo l'ultimo elemento, togliamo l'ultimo padding
    totalLegendWidth = currentX - legendPadding;

    // 3. Centra l'intero contenitore
    const legendX = (width - totalLegendWidth) / 2;

    // Riposiziona il contenitore al centro
    legendContainer.attr("transform", `translate(${legendX}, ${legendY})`);

    // --- FINE MODIFICA LEGGENDA ---

}).catch(function(error) {
    console.error("Error loading ../../data/lab2/Year_Events_UKR.json:", error);
    d3.select("#stacked-bar-chart-container") 
      .append("text")
      .text("Error: could not load data.");
});