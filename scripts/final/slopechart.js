(function() {
    // ==========================================
    // --- 1. CONFIGURAZIONE FILE E PERCORSI ---
    // ==========================================
    
    const RUS_export_2021 = "../../data/final/trade-data/final_datasets/RUS_export_2021_grouped.json";
    const RUS_export_2023 = "../../data/final/trade-data/final_datasets/RUS_export_2023_grouped.json";
    const UKR_export_2021 = "../../data/final/trade-data/final_datasets/UKR_export_2021_grouped.json";
    const UKR_export_2023 = "../../data/final/trade-data/final_datasets/UKR_export_2023_grouped.json";

    // Configurazione Grafica
    const width = 1000;
    const height = 700;
    const margin = { top: 60, right: 250, bottom: 50, left: 250 }; 

    // Colori
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    // Variabili di stato
    let rawData = {};
    let svg;

    // --- FORMATTERS ---
    // Per le etichette visuali (Percentuali)
    const formatPercentage = (val) => val.toFixed(1) + "%";
    
    // Per il Tooltip (Euro)
    const formatEuro = (val) => {
        if (val >= 1e9) return "€" + (val / 1e9).toFixed(1) + "B";
        if (val >= 1e6) return "€" + (val / 1e6).toFixed(1) + "M";
        return "€" + val.toFixed(0);
    };

    // ==========================================
    // --- 2. CARICAMENTO DATI ---
    // ==========================================
    Promise.all([
        d3.json(RUS_export_2021),
        d3.json(RUS_export_2023),
        d3.json(UKR_export_2021),
        d3.json(UKR_export_2023)
    ]).then(function([r21, r23, u21, u23]) {
        
        rawData = {
            RUS: { y2021: r21, y2023: r23 },
            UKR: { y2021: u21, y2023: u23 }
        };

        initLayout();
        setupControls();
        updateChart("RUS"); 

    }).catch(err => {
        console.error("ERRORE DI CARICAMENTO:", err);
        d3.select("#slope-chart-container").html(`<p style="color:red">Errore caricamento dati: ${err}</p>`);
    });

    // ==========================================
    // --- 3. PREPARAZIONE DATI ---
    // ==========================================
    function processData(countryCode) {
        const d21 = rawData[countryCode].y2021;
        const d23 = rawData[countryCode].y2023;
        
        // Calcolo Totali per le percentuali
        const total21 = Object.values(d21).reduce((acc, curr) => acc + curr, 0);
        const total23 = Object.values(d23).reduce((acc, curr) => acc + curr, 0);

        const categories = Object.keys(d21); 
        
        const processed = categories.map(cat => {
            const val21 = d21[cat] || 0;
            const val23 = d23[cat] || 0;

            return {
                category: cat,
                // Percentuali per l'asse Y
                val2021: total21 ? (val21 / total21) * 100 : 0,
                val2023: total23 ? (val23 / total23) * 100 : 0,
                // Valori grezzi per il Tooltip
                raw2021: val21, 
                raw2023: val23
            };
        });

        processed.sort((a, b) => b.val2021 - a.val2021);
        return processed;
    }

    // ==========================================
    // --- 4. DISEGNO LAYOUT (Init) ---
    // ==========================================
    function initLayout() {
        d3.select("#slope-chart-container svg").remove();

        svg = d3.select("#slope-chart-container").append("svg")
            .attr("viewBox", [0, 0, width, height])
            .style("background", "#ffffff")
            .style("font-family", "sans-serif");

        // Coordinate X per gli assi (coincidono con i margini definiti)
        const x1 = margin.left;
        const x2 = width - margin.right;
        const yTop = margin.top;
        const yBottom = height - margin.bottom;

        // --- NUOVO: AGGIUNTA ASSI VERTICALI ---
        
        // Asse Sinistro (2021)
        svg.append("line")
            .attr("x1", x1)
            .attr("x2", x1)
            .attr("y1", yTop)
            .attr("y2", yBottom)
            .attr("stroke", "black")       // Colore nero
            .attr("stroke-width", 1)       // Linea fine
            .attr("shape-rendering", "crispEdges"); // Rende la linea nitida (pixel-perfect)

        // Asse Destro (2023)
        svg.append("line")
            .attr("x1", x2)
            .attr("x2", x2)
            .attr("y1", yTop)
            .attr("y2", yBottom)
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("shape-rendering", "crispEdges");

        // --------------------------------------

        // Intestazioni Anni
        svg.append("text")
            .attr("x", margin.left)
            .attr("y", margin.top - 25)
            .attr("text-anchor", "middle")
            .style("font-weight", "bold").style("font-size", "22px").style("fill", "#333")
            .text("2021");

        svg.append("text")
            .attr("x", width - margin.right)
            .attr("y", margin.top - 25)
            .attr("text-anchor", "middle")
            .style("font-weight", "bold").style("font-size", "22px").style("fill", "#333")
            .text("2023");

        // Gruppi dati (aggiunti DOPO gli assi, così stanno sopra)
        svg.append("g").attr("class", "lines-group");
        svg.append("g").attr("class", "dots-group");
        svg.append("g").attr("class", "labels-group");
    }

    // ==========================================
    // --- 5. AGGIORNAMENTO GRAFICO (Update) ---
    // ==========================================
    function updateChart(countryCode) {
        const data = processData(countryCode);

        // Scala Sqrt per le percentuali
        const maxVal = d3.max(data, d => Math.max(d.val2021, d.val2023));
        const y = d3.scaleSqrt()
            .domain([0, maxVal]) 
            .range([height - margin.bottom, margin.top]);

        const x1 = margin.left;
        const x2 = width - margin.right;
        const t = svg.transition().duration(1000).ease(d3.easeCubic);

        // --- 1. LINEE ---
        svg.select(".lines-group")
            .selectAll("line")
            .data(data, d => d.category)
            .join(
                enter => enter.append("line")
                    .attr("class", "slope-line")
                    .attr("stroke", d => colorScale(d.category))
                    .attr("stroke-width", 3)
                    .attr("stroke-linecap", "round")
                    .attr("opacity", 0)
                    .attr("x1", x1).attr("x2", x2)
                    .attr("y1", d => y(d.val2021)).attr("y2", d => y(d.val2023))
                    .call(enter => enter.transition(t).attr("opacity", 0.7)),
                update => update.call(update => update.transition(t)
                    .attr("stroke", d => colorScale(d.category))
                    .attr("y1", d => y(d.val2021)).attr("y2", d => y(d.val2023))),
                exit => exit.transition(t).attr("opacity", 0).remove()
            )
            // Aggiungiamo eventi anche alle linee
            .on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut)
            .on("mousemove", moveTooltip);

        // --- 2. PALLINI ---
        const dotsData = [];
        data.forEach(d => {
            // Passiamo anche raw2021/23 per il tooltip sui pallini
            dotsData.push({ 
                id: d.category + "_21", cat: d.category, val: d.val2021, x: x1, side: 'left',
                raw2021: d.raw2021, raw2023: d.raw2023 
            });
            dotsData.push({ 
                id: d.category + "_23", cat: d.category, val: d.val2023, x: x2, side: 'right',
                raw2021: d.raw2021, raw2023: d.raw2023
            });
        });

        svg.select(".dots-group")
            .selectAll("circle")
            .data(dotsData, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("class", "slope-dot")
                    .attr("r", 5)
                    .attr("fill", d => colorScale(d.cat))
                    .attr("cx", d => d.x).attr("cy", d => y(d.val))
                    .attr("opacity", 0)
                    .call(enter => enter.transition(t).attr("opacity", 1)),
                update => update.call(update => update.transition(t)
                    .attr("fill", d => colorScale(d.cat))
                    .attr("cy", d => y(d.val))),
                exit => exit.transition(t).attr("opacity", 0).remove()
            )
            // Eventi sui pallini
            .on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut)
            .on("mousemove", moveTooltip);

        // --- 3. ETICHETTE ---
        const labelGroup = svg.select(".labels-group");
        
        const leftData = data.map(d => ({ ...d, y: y(d.val2021), side: 'left' }));
        const rightData = data.map(d => ({ ...d, y: y(d.val2023), side: 'right' }));

        renderSideLabels(labelGroup, leftData, x1, "end", t);
        renderSideLabels(labelGroup, rightData, x2, "start", t);
    }

    // ==========================================
    // --- GESTIONE INTERAZIONE (MouseOver/Out) ---
    // ==========================================
    
    function handleMouseOver(event, d) {
        // Normalizziamo il dato: 'd' potrebbe essere un pallino (d.cat) o una linea/label (d.category)
        const category = d.category || d.cat; 
        
        // 1. Highlight Visuale
        d3.selectAll(".slope-line, .slope-label, .slope-dot").attr("opacity", 0.1);

        d3.selectAll(".slope-line").filter(l => l.category === category)
            .attr("opacity", 1).attr("stroke-width", 5);

        d3.selectAll(".slope-label").filter(l => l.category === category)
            .attr("opacity", 1).style("font-size", "14px");
        
        d3.selectAll(".slope-dot").filter(l => l.cat === category)
            .attr("opacity", 1).attr("r", 7);

        // 2. Mostra Tooltip
        const tooltip = d3.select("#slope-chart-tooltip");
        
        // I valori raw sono disponibili in 'd' (per linee/label) o abbiamo bisogno di recuperarli se mancano
        // (nel codice attuale li ho passati ovunque, quindi d.raw2021 esiste)
        
        const val21 = formatEuro(d.raw2021);
        const val23 = formatEuro(d.raw2023);

        const htmlContent = `
            <div style="font-weight:bold; margin-bottom:4px; color:${colorScale(category)}">${category}</div>
            <div style="display:flex; justify-content:space-between; gap:10px;">
                <span>2021:</span> <span style="font-weight:bold;">${val21}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:10px;">
                <span>2023:</span> <span style="font-weight:bold;">${val23}</span>
            </div>
        `;

        tooltip.html(htmlContent)
            .style("visibility", "visible")
            .style("top", (event.pageY + 15) + "px")
            .style("left", (event.pageX + 15) + "px");
    }

    function moveTooltip(event) {
        d3.select("#slope-chart-tooltip")
            .style("top", (event.pageY + 15) + "px")
            .style("left", (event.pageX + 15) + "px");
    }

    function handleMouseOut(event, d) {
        // 1. Ripristina Stili
        d3.selectAll(".slope-line").attr("opacity", 0.7).attr("stroke-width", 3);
        d3.selectAll(".slope-label").attr("opacity", 1).style("font-size", "12px");
        d3.selectAll(".slope-dot").attr("opacity", 1).attr("r", 5);

        // 2. Nascondi Tooltip
        d3.select("#slope-chart-tooltip").style("visibility", "hidden");
    }

    // ==========================================
    // --- FUNZIONI DI RENDER ETICHETTE ---
    // ==========================================

    function renderSideLabels(container, data, xPos, anchor, transition) {
        const spacedData = relaxLabels(data, 16); 

        const labels = container.selectAll(`text.label-${data[0].side}`)
            .data(spacedData, d => d.category)
            .join(
                enter => enter.append("text")
                    .attr("class", `label-${data[0].side} slope-label`)
                    .attr("dy", "0.35em")
                    .style("font-size", "12px")
                    .style("font-weight", "bold")
                    .style("cursor", "pointer") // Cursore manina
                    .style("fill", d => colorScale(d.category)) 
                    .attr("opacity", 0)
                    .call(enter => enter.transition(transition).attr("opacity", 1)),
                update => update.call(update => update.transition(transition)
                    .style("fill", d => colorScale(d.category))),
                exit => exit.remove()
            );

        labels
            .attr("x", xPos + (data[0].side === 'left' ? -15 : 15))
            .attr("text-anchor", anchor)
            .text(d => data[0].side === 'left' 
                ? `${d.category} ${formatPercentage(d.val2021)}` 
                : formatPercentage(d.val2023))
            .transition(transition)
            .attr("y", d => d.yFixed);

        // Colleghiamo i gestori eventi unificati
        labels
            .on("mouseover", handleMouseOver)
            .on("mouseout", handleMouseOut)
            .on("mousemove", moveTooltip);
    }

    function relaxLabels(data, spacing) {
        let nodes = data.map(d => ({ ...d, yFixed: d.y }));
        nodes.sort((a, b) => a.y - b.y);

        for (let i = 1; i < nodes.length; i++) {
            let prev = nodes[i - 1];
            let curr = nodes[i];
            
            if (curr.yFixed < prev.yFixed + spacing) {
                curr.yFixed = prev.yFixed + spacing;
            }
        }
        
        const last = nodes[nodes.length - 1];
        if (last && last.yFixed > height - margin.bottom) {
             const diff = last.yFixed - (height - margin.bottom);
             nodes.forEach(n => n.yFixed -= diff);
        }
        return nodes;
    }

    // ==========================================
    // --- 6. PULSANTI ---
    // ==========================================
    function setupControls() {
        const container = document.getElementById("slope-controls");
        if(!container) return;
        container.innerHTML = "";

        const createBtn = (text, code) => {
            const btn = document.createElement("button");
            btn.innerText = text;
            btn.className = "btn btn-outline-secondary btn-sm"; 
            btn.style.minWidth = "100px";
            btn.onclick = (e) => {
                Array.from(container.children).forEach(b => {
                    b.classList.remove("active");
                    b.classList.remove("btn-secondary");
                    b.classList.add("btn-outline-secondary");
                });
                e.target.classList.add("active");
                e.target.classList.remove("btn-outline-secondary");
                e.target.classList.add("btn-secondary");
                
                updateChart(code);
            };
            return btn;
        };

        const btnRus = createBtn("Russia", "RUS");
        btnRus.classList.add("active", "btn-secondary");
        btnRus.classList.remove("btn-outline-secondary");
        
        container.appendChild(btnRus);
        container.appendChild(createBtn("Ucraina", "UKR"));
    }


            // --- HELP BUTTON ---
        const helpContent = {
            title: "Reading the Food Price Index",
            steps: [
                "<strong>Y-axis:</strong> FAO Price Index value.",
                "<strong>Lines:</strong> Price trends for different commodity groups.",
                "<strong>Interaction:</strong> Click legend to isolate a specific commodity."
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#slope-help-container", "#slope-chart-wrapper", helpContent);
        }

})();