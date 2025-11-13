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
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");
    
    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", marginTop / 2)
        .attr("text-anchor", "middle") 
        .attr("class", "graph-title")
        .text("Evolution of the Main Assault Tactics on Ukrainian Territory"); 


    // Line generation function
    const line = d3.line()
        .defined(d => !isNaN(d.value))
        .x(d => x(d.date))
        .y(d => y(d.value));

    
    // Draw the chart lines
    const paths = svg.append("g") 
        .attr("fill", "none")
        .attr("stroke-width", 2.5) 
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
      .selectAll(".line-path") 
      .data(groups) 
      .join("path")
        .attr("class", "line-path") 
        .style("mix-blend-mode", "multiply")
        .attr("stroke", ([key]) => color(key)) 
        .attr("d", ([, values]) => line(values));


    // --- Funzioni di Animazione e Reset ---

    // La funzione di preparazione e nascondimento
    function resetLines() {
        // Interrompe eventuali transizioni in corso
        paths.interrupt(); 
        
        // Applica l'attributo per nascondere la linea
        paths.each(function() {
            const length = this.getTotalLength(); 
            d3.select(this)
                .attr("stroke-dasharray", length + " " + length)
                .attr("stroke-dashoffset", length); // Nasconde la linea
        });
    }

    // La funzione per avviare l'animazione di disegno
    function startDrawingAnimation() {
        // Eseguiamo il reset prima di avviare l'animazione per sicurezza
        resetLines(); 
        
        paths.transition()
            .duration(5000) 
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0); // Disegna la linea
    }

    // --- AGGIUNTA INTERSECTION OBSERVER per l'animazione allo scroll ---
    const chartContainerElement = document.querySelector("#line-chart-container");
    
    if (chartContainerElement && 'IntersectionObserver' in window) {
        
        // 1. Nascondiamo le linee all'inizio, con un piccolo ritardo per garantire che getTotalLength funzioni
        setTimeout(resetLines, 50);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                
                // Entrata nella viewport: Avvia l'animazione
                if (entry.isIntersecting) {
                    // Timeout di sicurezza per l'animazione
                    setTimeout(startDrawingAnimation, 300); 
                } 
                // Uscita dalla viewport: Resetta la linea
                else {
                    // Timeout di sicurezza per il reset
                    setTimeout(resetLines, 50); 
                }
            });
        }, {
            // Un threshold di 0.5 è un buon equilibrio (il 50% è visibile)
            threshold: 0.5 
        });
        
        // Inizia l'osservazione
        observer.observe(chartContainerElement);

    } else {
        // Fallback: se Observer non è supportato o contenitore non trovato, avvia subito l'animazione
        console.warn("IntersectionObserver non supportato o contenitore non trovato. Animazione forzata all'avvio.");
        setTimeout(startDrawingAnimation, 100); 
    }
    // --- FINE INTERSECTION OBSERVER ---


    // Add x-axes
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x)
            .ticks(d3.timeMonth.every(6)) 
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
        .attr("x", -marginLeft + 10) 
        .attr("y", marginTop - 20) 
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .text("Number of Events"); 


    // Margine fisso che vuoi tra la fine di una label testuale e il prossimo quadratino
    const legendPadding = 40; 
    
    // Posiziona la legenda sotto l'asse X (che è a height - marginBottom)
    const legendY = height - marginBottom + 80 ; 

    // Build the legend container (temporaneamente a sinistra per misurare le larghezze)
    const legendContainer = svg.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(0, ${legendY})`);

    // 1. Crea i gruppi con rettangoli (linee) e testo
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
    totalLegendWidth = currentX - legendPadding;

    // 3. Centra l'intero contenitore
    const legendX = (width - totalLegendWidth) / 2;

    // Riposiziona il contenitore al centro e in basso
    legendContainer.attr("transform", `translate(${legendX}, ${legendY})`);


    //Interactive part (tooltip e hover) (omesso per brevità, non è stato modificato)
    const points = data.map((d) => [x(d.date), y(d.value), d.division, d.date, d.value]);
    const tooltipDateFormat = d3.timeFormat("%d %b %Y"); 

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
        
        const i = d3.leastIndex(points, ([xCoord, yCoord]) => Math.hypot(xCoord - xm, yCoord - ym));
        
        const [px, py, k, date, value] = points[i]; 
        
        paths.style("stroke", ([key]) => key === k ? color(k) : "#ddd") 
            .filter(([key]) => key === k).raise();
        
        dot.attr("transform", `translate(${px},${py})`);
        dot.select("text").text(`${k}: ${Math.round(value)} (${tooltipDateFormat(date)})`);
        
        dot.attr("display", null);
    }

    function pointerentered() {
        paths.style("mix-blend-mode", null).style("stroke", "#ddd"); 
        dot.attr("display", null);
    }

    function pointerleft() {
        paths.style("mix-blend-mode", "multiply").style("stroke", ([key]) => color(key)); 
        dot.attr("display", "none");
    }

}).catch(function(error) {
    console.error("Errore nel caricamento del file JSON:", error);
    d3.select("#line-chart-container") 
      .append("text")
      .text("Errore: impossibile caricare i dati. Controllare la console per i dettagli.");
});