(function() { 
    // ==========================================
    // --- CONFIGURAZIONE ---
    // ==========================================
    const pathFile = "../../data/final/FlightsUKR/fly/sankey.csv"; 

    const width = 1000;
    const height = 600;
    const margin = { top: 20, right: 150, bottom: 20, left: 150 };

    const monthNames = {
        1: "Gennaio", 2: "Febbraio", 3: "Marzo", 4: "Aprile", 
        5: "Maggio", 6: "Giugno", 7: "Luglio", 8: "Agosto", 
        9: "Settembre", 10: "Ottobre", 11: "Novembre", 12: "Dicembre"
    };

    let globalData = [];
    let currentYear = 2019;
    let currentMonth = 1;
    let svg, sankey, colorScale;

    // ==========================================
    // --- CARICAMENTO DATI ---
    // ==========================================
    d3.csv(pathFile, d => ({
        year: +d.year,          // Forza numero
        month: +d.month,        // Forza numero
        source: d.source_name,
        target: d.target_name,
        value: +d.value         // Forza numero
    })).then(rawData => {
        globalData = rawData;
        console.log(`Dati caricati: ${globalData.length} righe.`);

        const container = d3.select("#sankey_chart");
        container.selectAll("*").remove();

        svg = container.append("svg")
            .attr("viewBox", [0, 0, width, height])
            .style("background", "#fff")
            .style("max-width", "100%")
            .style("height", "auto");

        sankey = d3.sankey()
            .nodeId(d => d.id) 
            .nodeWidth(20)
            .nodePadding(20)
            .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

        // ==========================================
        // --- GESTIONE COLORI PERSONALIZZATA ---
        // ==========================================
        
        // 1. Mappatura Specifica: Paesi -> Colore Fisso
        const specificColors = {
            "Russia":    "#003f5c",
            "Ukraine":   "#374c80",
            "Poland":    "#7a5195",
            "Hungary":   "#bc5090",
            "Romania":   "#ef5675",
            "Lithuania": "#ff764a",
            "Slovakia":  "#ffa600"
        };

        // 2. Palette di Riserva per "Tutti gli altri" (15 colori sfumati)
        const fallbackPalette = [
            "#003f5c", "#17456b", "#2f4a7a", "#494d86", "#67508f", 
            "#835194", "#9f5092", "#bd5090", "#d25384", "#e85579", 
            "#f45f69", "#fb6d56", "#ff7d3f", "#ff921f", "#ffa600"
        ];
        
        // Scala D3 per gestire i colori di fallback in modo ordinato
        const fallbackScale = d3.scaleOrdinal(fallbackPalette);

        // 3. Funzione personalizzata che sostituisce la scala standard
        colorScale = function(name) {
            // Pulisci il nome da eventuali spazi
            const cleanName = name ? name.trim() : "";

            // Se il nome è nella lista specifica, usa quel colore
            if (specificColors.hasOwnProperty(cleanName)) {
                return specificColors[cleanName];
            }
            
            // Altrimenti, assegna un colore dalla palette di riserva
            return fallbackScale(cleanName);
        };

        // --- ATTIVAZIONE SLIDER ---
        // Collega lo slider HTML alla logica JS
        const slider = d3.select("#monthSlider");
        if (!slider.empty()) {
            slider.on("input", function(event) {
                currentMonth = +this.value; // Legge il valore (1-12)
                d3.select("#monthDisplay").text(monthNames[currentMonth]); // Aggiorna testo
                updateChart(); // Ridisegna grafico
            });
        } else {
            console.warn("Attenzione: Slider HTML (#monthSlider) non trovato!");
        }

        updateChart();

    }).catch(err => console.error("Errore Caricamento:", err));


    // ==========================================
    // --- FUNZIONI GLOBALI (ANNO) ---
    // ==========================================
    window.updateFocusSankey = function(year) {
        currentYear = +year; // Forza numero
        console.log("Anno selezionato:", currentYear);
        
        // Aggiorna bottoni attivi
        d3.selectAll("button").classed("active", false);
        const buttons = document.querySelectorAll("button");
        buttons.forEach(btn => {
            if(btn.textContent.includes(year.toString()) || 
               (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(year.toString()))) {
                btn.classList.add("active");
            }
        });

        updateChart();
    };
    
    // Alias per compatibilità con eventuali vecchie chiamate HTML
    window.updateYear = window.updateFocusSankey;


    // ==========================================
    // --- LOGICA DI DISEGNO ---
    // ==========================================
    function updateChart() {
        if (!globalData.length) return;

        // FILTRO: Usa '==' per essere tollerante (numero vs stringa)
        let flows = globalData.filter(d => d.year == currentYear && d.month == currentMonth);

        if (flows.length === 0) {
            svg.selectAll("*").remove();
            svg.append("text")
                .attr("x", width / 2).attr("y", height / 2)
                .attr("text-anchor", "middle")
                .style("font-size", "20px").style("fill", "#666")
                .text(`Nessun dato per ${monthNames[currentMonth]} ${currentYear}`);
            return;
        }

        // Ordina e prendi Top 15 (per coerenza con la palette)
        flows.sort((a, b) => b.value - a.value);
        flows = flows.slice(0, 15);

        // Prepara Nodi e Link
        const nodesMap = new Map();
        const links = [];

        flows.forEach(flow => {
            const srcId = flow.source + "_src";
            const tgtId = flow.target + "_tgt";

            if (!nodesMap.has(srcId)) nodesMap.set(srcId, { id: srcId, name: flow.source, type: "source" });
            if (!nodesMap.has(tgtId)) nodesMap.set(tgtId, { id: tgtId, name: flow.target, type: "target" });

            links.push({ source: srcId, target: tgtId, value: flow.value });
        });

        const nodes = Array.from(nodesMap.values());
        const graph = { nodes, links };

        drawSankey(graph);
    }

    function drawSankey(graph) {
        svg.selectAll("*").remove();

        const { nodes, links } = sankey({
            nodes: graph.nodes.map(d => Object.assign({}, d)),
            links: graph.links.map(d => Object.assign({}, d))
        });

        // Link
        const link = svg.append("g")
            .attr("fill", "none")
            .attr("stroke-opacity", 0.5)
            .selectAll("g").data(links).join("g")
            .style("mix-blend-mode", "multiply");

        const gradient = link.append("linearGradient")
            .attr("id", d => (d.uid = `link-${Math.random().toString(36).substr(2, 9)}`))
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", d => d.source.x1).attr("x2", d => d.target.x0);

        // Usa la funzione colorScale personalizzata
        gradient.append("stop").attr("offset", "0%").attr("stop-color", d => colorScale(d.source.name));
        gradient.append("stop").attr("offset", "100%").attr("stop-color", "#333");

        link.append("path")
            .attr("d", d3.sankeyLinkHorizontal())
            .attr("stroke", d => `url(#${d.uid})`)
            .attr("stroke-width", d => Math.max(1, d.width))
            .on("mouseover", function() { d3.select(this).attr("stroke-opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).attr("stroke-opacity", 0.5); });

        link.append("title").text(d => `${d.source.name} → ${d.target.name}\n${d3.format(",.0f")(d.value)} Voli`);

        // Nodi
        const node = svg.append("g")
            .selectAll("rect").data(nodes).join("rect")
            .attr("x", d => d.x0).attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0).attr("width", d => d.x1 - d.x0)
            // Usa la funzione colorScale personalizzata
            .attr("fill", d => d.name === "Russia" ? "#333" : colorScale(d.name))
            .attr("stroke", "#000");

        node.append("title").text(d => `${d.name}\n${d3.format(",.0f")(d.value)} Totali`);

        // Etichette
        svg.append("g")
            .attr("font-family", "sans-serif").attr("font-size", 12).style("font-weight", "bold")
            .selectAll("text").data(nodes).join("text")
            .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
            .attr("y", d => (d.y1 + d.y0) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
            .text(d => d.name);
    }
})();