// File: grouped_bar_chart.js

// Load the file json
d3.json("../../data/lab2/Events_UKR_RUS.json").then(function(data) {
    
    // Definition of the sizes and margins
    const width = 1000;
    const height = 600;
    const marginTop = 60;
    const marginRight = 50; 
    const marginBottom = 70;
    const marginLeft = 50;

    
    // Extraction of the events and countries
    const eventTypes = [...new Set(data.map(d => d.EVENT_TYPE))].sort(d3.ascending);
    const countries = [...new Set(data.map(d => d.COUNTRY))].sort(); 

    // Definition of the x axis
    const fx = d3.scaleBand()
        .domain(eventTypes)
        .rangeRound([marginLeft, width - marginRight])
        .paddingInner(0.1);

    // Subgroup scale: for the countries within each event type
    const x = d3.scaleBand()
        .domain(countries)
        .rangeRound([0, fx.bandwidth()])
        .padding(0.05);

    // Color to encode Russia and Ukraine
    const color = d3.scaleOrdinal()
        .domain(countries)
        .range(["#C8102E", "#002677"]); 

    // Definition of the y axis
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)]).nice()
        .rangeRound([height - marginBottom, marginTop]);

    // Building of the SVG container
    const svg = d3.select("#grouped-bar-chart-container")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto;");

    // Add the title
    svg.append("text")
        .attr("class", "graph-title")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle")
        .text("Comparison of Civil Unrest and Violence in Russia and Ukraine since 2017");


    // Append the x axis 
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(fx).tickSizeOuter(0))
        .call(g => g.selectAll(".domain").remove());

    // --- RIMOSSO ---
    // // Append the y axis 
    // svg.append("g")
    //     .attr("transform", `translate(${marginLeft},0)`)
    //     .call(d3.axisLeft(y).ticks(null, "s"));
    // --- FINE RIMOZIONE ---


    // --- MODIFICATO: Legenda Orizzontale in Basso al Centro ---
    
    // Spazio stimato per ogni elemento della legenda (rettangolo + testo + padding)
    const legendItemWidth = 90; // Regola questo valore se i nomi dei paesi sono lunghi
    const totalLegendWidth = countries.length * legendItemWidth;
    
    // Calcola la posizione X per centrare la legenda
    // (width / 2) - (totalLegendWidth / 2)
    const legendX = (width - totalLegendWidth) / 2;
    
    // Posiziona la legenda 15px sotto la linea dell'asse x (che è a height - marginBottom)
    // Si posizionerà all'interno dell'area definita da marginBottom
    const legendY = height - marginBottom + 50 ; 

    // Add and define a legend 
    const legend = svg.append("g")
        .attr("class", "legend")
        // Applica la trasformazione calcolata per centrare e posizionare in basso
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.selectAll("rect")
        .data(countries)
        .join("rect")
        .attr("x", (d, i) => i * legendItemWidth) // Posiziona orizzontalmente in base all'indice
        .attr("y", 0) // Posizione Y fissa all'interno del gruppo legenda
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", color);

    legend.selectAll("text")
        .data(countries)
        .join("text")
        .attr("x", (d, i) => i * legendItemWidth + 20) // Posiziona testo 20px a dx del rettangolo
        .attr("y", 12) // Allinea verticalmente il testo (altezza 15 / 2 + offset)
        .text(d => d)
        .attr("class", "legend-text");   
    // --- FINE MODIFICA LEGGENDA ---


    // Building of the Grouped bar chart
    svg.append("g")
      .selectAll()
      .data(d3.group(data, d => d.EVENT_TYPE)) 
      .join("g")
        .attr("transform", ([eventType]) => `translate(${fx(eventType)},0)`) 
      .selectAll()
      .data(([, d]) => d) 
      .join("rect")
        .attr("x", d => x(d.COUNTRY))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => y(0) - y(d.count))
        .attr("fill", d => color(d.COUNTRY))
      .append("title")
      .text(d => `Type: ${d.EVENT_TYPE}\nCountry: ${d.COUNTRY}\nCount: ${d.count}`);

    // --- AGGIUNTO: Testo con i valori sopra le barre ---
    svg.append("g")
      .selectAll()
      .data(d3.group(data, d => d.EVENT_TYPE))
      .join("g")
        .attr("transform", ([eventType]) => `translate(${fx(eventType)},0)`)
      .selectAll()
      .data(([, d]) => d)
      .join("text")
        .attr("class", "bar-value") // Classe per lo styling CSS
        .attr("x", d => x(d.COUNTRY) + x.bandwidth() / 2) // Posiziona in mezzo alla barra
        .attr("y", d => y(d.count) - 5) // Posiziona 5px sopra la barra
        .attr("text-anchor", "middle") // Centra il testo
        .text(d => d.count); // Mostra il valore 'count'
    // --- FINE AGGIUNTA ---

}).catch(function(error) {
    console.error("Error loading Events_UKR_RUS.json:", error);
    d3.select("#grouped-bar-chart-container") 
      .append("text")
      .text("Error: could not load data.");
});