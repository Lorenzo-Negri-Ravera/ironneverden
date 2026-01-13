/*
{
    // ==========================================
    // --- CONFIGURAZIONE ---
    // ==========================================

    // Assicurati che questo percorso sia corretto rispetto al tuo file HTML
    const path = "../../data/final/FlightsUKR/fly/df_totale_dest_.csv";

    // Mappa per convertire i codici ISO in Nomi Completi
    const codeToName = {
        "DE": "Germany", "GB": "United Kingdom", "FR": "France", "IT": "Italy",
        "ES": "Spain", "RU": "Russia", "TR": "Turkey", "CH": "Switzerland",
        "NL": "Netherlands", "SE": "Sweden", "NO": "Norway", "BE": "Belgium",
        "AT": "Austria", "DK": "Denmark", "PL": "Poland", "PT": "Portugal",
        "IE": "Ireland", "GR": "Greece", "FI": "Finland", "CZ": "Czech Republic",
        "HU": "Hungary", "UA": "Ukraine", "IL": "Israel", "LV": "Latvia",
        "RO": "Romania", "LU": "Luxembourg", "IS": "Iceland", "KZ": "Kazakhstan",
        "HR": "Croatia", "RS": "Serbia", "MT": "Malta", "EE": "Estonia",
        "SK": "Slovakia", "SI": "Slovenia", "LT": "Lithuania", "CY": "Cyprus",
        "BG": "Bulgaria", "PK": "Pakistan", "BY": "Belarus", "BA": "Bosnia and Herzegovina",
        "GE": "Georgia", "AZ": "Azerbaijan", "GI": "Gibraltar", "MD": "Moldova"
    };

    // Stati da visualizzare
    const neigh = ["Poland", "Romania", "Slovakia", "Hungary", "Lithuania", "Ukraine", "Russia"];

    // --- PALETTE COLORI ---
    const customPalette = [
        "#003f5c",
        "#374c80",
        "#7a5195",
        "#bc5090",
        "#ef5675",
        "#ff764a",
        "#ffa600"
    ];

    const duration = 5000; 
    const k = 10;          

    // --- DIMENSIONI STANDARD ---
    const width = 1000;     
    
    // Altezza barre aumentata per riempire meglio la card
    const barSize = 48;     
    
    // Margini ottimizzati per il box CSS
    const margin = { top: 20, right: 30, bottom: 40, left: 70 }; 

    let n, height; 
    let svg, keyframes;
    let hoveredCountry = null; 

    // ==========================================
    // --- MAIN ---
    // ==========================================
    d3.csv(path).then(function(rawData) {
        
        let data = processData(rawData);
        
        // Filtro: solo paesi in 'neigh' e valori > 0
        data = data.filter(d => neigh.includes(d.name) && d.value > 0);

        if (data.length === 0) throw new Error("Nessun dato valido trovato.");

        const names = new Set(data.map(d => d.name));
        n = names.size; 
        
        height = margin.top + barSize * n + margin.bottom;

        const dateValues = Array.from(d3.rollup(data, ([d]) => d.value, d => d.year, d => d.name))
            .map(([date, data]) => [new Date(date, 0, 1), data])
            .sort(([a], [b]) => d3.ascending(a, b));

        keyframes = [];
        let ka, a, kb, b;
        for ([[ka, a], [kb, b]] of d3.pairs(dateValues)) {
            for (let i = 0; i < k; ++i) {
                const t = i / k;
                keyframes.push([
                    new Date(ka * (1 - t) + kb * t),
                    rank(name => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t, names)
                ]);
            }
        }
        keyframes.push([new Date(kb), rank(name => b.get(name) || 0, names)]);

        d3.select("#chart-container svg").remove();
        svg = d3.select("#chart-container").append("svg")
            .attr("viewBox", [0, 0, width, height]);
            
        createLegend();
        renderStaticElements();
        runAnimation();

    }).catch(err => {
        console.error("Errore:", err);
        alert("Errore nel caricamento. Controlla la console (F12) per i dettagli.");
    });

    // ==========================================
    // --- FUNZIONI DI SUPPORTO ---
    // ==========================================

    function processData(csvData) {
        const rollup = d3.rollup(csvData, 
            v => ({
                2019: d3.sum(v, d => +d['2019']),
                2020: d3.sum(v, d => +d['2020']),
                2021: d3.sum(v, d => +d['2021']),
                2022: d3.sum(v, d => +d['2022'])
            }),
            d => d.destination_name 
        );

        const output = [];
        for (const [code, years] of rollup) {
            if (!code) continue; 
            const fullName = codeToName[code] || code;
            output.push({ name: fullName, year: 2019, value: years[2019] });
            output.push({ name: fullName, year: 2020, value: years[2020] });
            output.push({ name: fullName, year: 2021, value: years[2021] });
            output.push({ name: fullName, year: 2022, value: years[2022] });
        }
        return output.sort((a,b) => a.year - b.year);
    }

    function rank(value, names) {
        const data = Array.from(names, name => ({name, value: value(name)}));
        data.sort((a, b) => d3.descending(a.value, b.value));
        for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
        return data;
    }

    function renderStaticElements() {
        svg.append("g").attr("class", "axis axis--top").attr("transform", `translate(0,${margin.top})`);
        svg.append("g").attr("class", "bars");
        svg.append("g").attr("class", "labels-name"); 
        svg.append("g").attr("class", "labels-value");
        svg.append("text").attr("class", "year-ticker").attr("x", width - 60).attr("y", height - 30).text(""); 
    }

    // ==========================================
    // --- UI (Legenda & Help) ---
    // ==========================================

    function createLegend() {
        const container = d3.select("#chart-container");
        if (container.select("#country-legend").empty()) {
            const legend = container.append("div")
                .attr("id", "country-legend")
                .attr("class", "legend-box hidden");
            
            legend.append("h3").attr("id", "legend-title").text("Dettagli");
            legend.append("p").html('Voli: <span id="legend-value">-</span>');
            legend.append("p").html('Anno: <span id="legend-year">-</span>');
        }
    }


    // How to read the chart
    const helpContent = {
        title: "How to read the Chart", 
        steps: [
            "<strong>Bar Race:</strong> Watch the evolution of air traffic over time.",
            "<strong>Length:</strong> Represents the total number of incoming flights.",
            "<strong>Colors:</strong> Each country has a distinct color for tracking."
        ]
    };

    if (typeof createChartHelp === "function") {
        d3.select("#race-help-container").html("");
        createChartHelp("#race-help-container", "#race-chart-wrapper", helpContent);
    } else {
        // Fallback manuale se non hai utils.js
        const container = d3.select("#race-help-container");
        container.html(`
            <div class="chart-help-trigger" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <div class="chart-help-icon" style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: black; color: white; border-radius: 50%; font-family: serif; font-weight: bold; font-style: italic; font-size: 12px;">i</div>
                <span class="chart-help-text" style="font-family: sans-serif; font-weight: 700; font-size: 14px; color: #000;">How to read the chart?</span>
            </div>
            `);
    }


    // ==========================================
    // --- ANIMAZIONE ---
    // ==========================================
    async function runAnimation() {
        const x = d3.scaleLinear([0, 1], [margin.left, width - margin.right]);
        const y = d3.scaleBand()
            .domain(d3.range(n + 1))
            .rangeRound([margin.top, margin.top + barSize * (n + 1 + 0.1)])
            .padding(0.1);
        
        const exitPosition = margin.top + barSize * (n + 1);
        
        // Applicazione Palette
        const highlightScale = d3.scaleOrdinal()
            .domain(neigh)
            .range(customPalette);

        const getColor = (name) => highlightScale(name); 

        for (const keyframe of keyframes) {
            const transition = svg.transition().duration(duration / k).ease(d3.easeLinear);
            const [date, data] = keyframe;

            const legendBox = d3.select("#country-legend");
            if(hoveredCountry) {
                const d = data.find(item => item.name === hoveredCountry);
                if(d) {
                    legendBox.classed("hidden", false);
                    d3.select("#legend-title").text(d.name);
                    d3.select("#legend-value").text(d3.format(",d")(d.value));
                    d3.select("#legend-year").text(d3.utcFormat("%Y")(date));
                }
            } else {
                legendBox.classed("hidden", true);
            }

            //x.domain([0, data[0].value]);
            x.domain([0, data[0].value / 0.75]);       // Changed to have a better perception of the Russia bar

            svg.select(".axis--top").transition(transition)
               .call(d3.axisTop(x).ticks(width / 120).tickSizeOuter(0).tickSizeInner(-barSize * (n + y.padding()))); 
            svg.select(".axis--top .domain").remove();

            svg.select(".bars").selectAll("rect")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("rect")
                        .attr("fill", d => getColor(d.name))
                        .attr("height", y.bandwidth())
                        .attr("x", x(0))
                        .attr("y", exitPosition)
                        .attr("width", d => x(d.value) - x(0))
                        .attr("cursor", "pointer")
                        .on("mouseover", (e, d) => { hoveredCountry = d.name; })
                        .on("mouseout", () => { hoveredCountry = null; }),
                    update => update.attr("fill", d => getColor(d.name)),
                    exit => exit.transition(transition).remove()
                        .attr("y", exitPosition)
                        .attr("width", d => x(d.value) - x(0))
                )
                .call(bar => bar.transition(transition)
                    .attr("y", d => y(d.rank))
                    .attr("width", d => x(d.value) - x(0))
                    .attr("fill-opacity", d => {
                        if (hoveredCountry) return d.name === hoveredCountry ? 1 : 0.3;
                        return 1;
                    })
                );

            svg.select(".labels-name").selectAll("text")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("class", "label-name")
                        .attr("text-anchor", "end") 
                        .attr("x", x(0) - 8)       
                        .attr("y", y.bandwidth() / 2)
                        .attr("dy", "0.1em")
                        .text(d => d.name)
                        .attr("transform", d => `translate(0,${exitPosition})`), 
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("transform", d => `translate(0,${exitPosition})`)
                )
                .call(text => text.transition(transition)
                    .attr("transform", d => `translate(0,${y(d.rank)})`)
                    .style("font-weight", "700") 
                    .style("fill", "#000")       
                );

            svg.select(".labels-value").selectAll("text")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("class", "label-value")
                        .attr("text-anchor", "start")
                        .attr("x", 6) 
                        .attr("y", y.bandwidth() / 2)
                        .attr("dy", "0.1em")
                        .text(d => d3.format(",d")(d.value))
                        .attr("transform", d => `translate(${x(d.value)},${exitPosition})`),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("transform", d => `translate(${x(d.value)},${exitPosition})`)
                )
                .call(text => text.transition(transition)
                    .attr("transform", d => `translate(${x(d.value)},${y(d.rank)})`)
                    .tween("text", function(d) {
                        const i = d3.interpolateNumber(this.textContent.replace(/,/g, "") || 0, d.value);
                        return function(t) { this.textContent = d3.format(",d")(i(t)); };
                    })
                );

            svg.select(".year-ticker").text(d3.utcFormat("%Y")(date));
            
            await transition.end();
        }
    }

    // Esponiamo replay globalmente
    window.replay = function() {
        hoveredCountry = null;
        d3.select("#country-legend").classed("hidden", true);
        svg.selectAll("*").remove();
        d3.select("#chart-container svg").attr("viewBox", [0, 0, width, height]);
        renderStaticElements();
        runAnimation();
    };

}
*/

{
    // ==========================================
    // --- CONFIGURAZIONE ---
    // ==========================================

    const path = "../../data/final/FlightsUKR/fly/df_totale_dest_.csv";

    const codeToName = {
        "DE": "Germany", "GB": "United Kingdom", "FR": "France", "IT": "Italy",
        "ES": "Spain", "RU": "Russia", "TR": "Turkey", "CH": "Switzerland",
        "NL": "Netherlands", "SE": "Sweden", "NO": "Norway", "BE": "Belgium",
        "AT": "Austria", "DK": "Denmark", "PL": "Poland", "PT": "Portugal",
        "IE": "Ireland", "GR": "Greece", "FI": "Finland", "CZ": "Czech Republic",
        "HU": "Hungary", "UA": "Ukraine", "IL": "Israel", "LV": "Latvia",
        "RO": "Romania", "LU": "Luxembourg", "IS": "Iceland", "KZ": "Kazakhstan",
        "HR": "Croatia", "RS": "Serbia", "MT": "Malta", "EE": "Estonia",
        "SK": "Slovakia", "SI": "Slovenia", "LT": "Lithuania", "CY": "Cyprus",
        "BG": "Bulgaria", "PK": "Pakistan", "BY": "Belarus", "BA": "Bosnia and Herzegovina",
        "GE": "Georgia", "AZ": "Azerbaijan", "GI": "Gibraltar", "MD": "Moldova"
    };

    const neigh = ["Poland", "Romania", "Slovakia", "Hungary", "Lithuania", "Ukraine", "Russia"];

    const customPalette = [
        "#003f5c", "#374c80", "#7a5195", "#bc5090", "#ef5675", "#ff764a", "#ffa600"
    ];

    const duration = 5000; 
    const k = 10;          
    const width = 1000;     
    const barSize = 48;     
    const margin = { top: 20, right: 30, bottom: 40, left: 70 }; 

    let n, height; 
    let svg, keyframes;
    let hoveredCountry = null; 
    
    // Variabile per salvare il massimo globale per il replay
    let storedGlobalMax = 0;

    // ==========================================
    // --- MAIN ---
    // ==========================================
    d3.csv(path).then(function(rawData) {
        
        let data = processData(rawData);
        data = data.filter(d => neigh.includes(d.name) && d.value > 0);

        if (data.length === 0) throw new Error("Nessun dato valido trovato.");

        const names = new Set(data.map(d => d.name));
        n = names.size; 
        
        height = margin.top + barSize * n + margin.bottom;

        // 1. CALCOLO DEL MASSIMO GLOBALE (Per asse fisso)
        const globalMax = d3.max(data, d => d.value);
        storedGlobalMax = globalMax; // Lo salviamo per il replay

        const dateValues = Array.from(d3.rollup(data, ([d]) => d.value, d => d.year, d => d.name))
            //.map(([date, data]) => [new Date(date, 0, 1), data])  // Assurda questa cosa
            .map(([date, data]) => [new Date(Date.UTC(date, 0, 1)), data])
            .sort(([a], [b]) => d3.ascending(a, b));

        keyframes = [];

        // 2. CREAZIONE INTRO (Partenza da 0)
        // Prendiamo la prima data reale (2019)
        const firstDate = dateValues[0][0];
        const firstData = dateValues[0][1];

        // Creiamo frame interpolati da 0 -> Valore 2019
        for (let i = 0; i < k; ++i) {
            const t = i / k;
            keyframes.push([
                firstDate, // La data rimane fissa all'inizio
                rank(name => {
                    const realValue = firstData.get(name) || 0;
                    return 0 * (1 - t) + realValue * t; // Interpola da 0 a Valore
                }, names)
            ]);
        }

        // 3. DATI NORMALI (2019 -> 2022)
        let ka, a, kb, b;
        for ([[ka, a], [kb, b]] of d3.pairs(dateValues)) {
            for (let i = 0; i < k; ++i) {
                const t = i / k;
                keyframes.push([
                    new Date(ka * (1 - t) + kb * t),
                    rank(name => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t, names)
                ]);
            }
        }
        keyframes.push([new Date(kb), rank(name => b.get(name) || 0, names)]);

        d3.select("#chart-container svg").remove();
        svg = d3.select("#chart-container").append("svg")
            .attr("viewBox", [0, 0, width, height]);
            
        createLegend();
        renderStaticElements();
        
        // Passiamo il massimo globale all'animazione
        runAnimation(globalMax);

    }).catch(err => {
        console.error("Errore:", err);
        alert("Errore nel caricamento. Vedi console.");
    });

    // ==========================================
    // --- FUNZIONI DI SUPPORTO ---
    // ==========================================

    function processData(csvData) {
        const rollup = d3.rollup(csvData, 
            v => ({
                2019: d3.sum(v, d => +d['2019']),
                2020: d3.sum(v, d => +d['2020']),
                2021: d3.sum(v, d => +d['2021']),
                2022: d3.sum(v, d => +d['2022'])
            }),
            d => d.destination_name 
        );

        const output = [];
        for (const [code, years] of rollup) {
            if (!code) continue; 
            const fullName = codeToName[code] || code;
            output.push({ name: fullName, year: 2019, value: years[2019] });
            output.push({ name: fullName, year: 2020, value: years[2020] });
            output.push({ name: fullName, year: 2021, value: years[2021] });
            output.push({ name: fullName, year: 2022, value: years[2022] });
        }
        return output.sort((a,b) => a.year - b.year);
    }

    function rank(value, names) {
        const data = Array.from(names, name => ({name, value: value(name)}));
        data.sort((a, b) => d3.descending(a.value, b.value));
        for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
        return data;
    }

    function renderStaticElements() {
        svg.append("g").attr("class", "axis axis--top").attr("transform", `translate(0,${margin.top})`);
        svg.append("g").attr("class", "bars");
        svg.append("g").attr("class", "labels-name"); 
        svg.append("g").attr("class", "labels-value");
        svg.append("text").attr("class", "year-ticker").attr("x", width - 60).attr("y", height - 30).text(""); 
    }

    function createLegend() {
        const container = d3.select("#chart-container");
        if (container.select("#country-legend").empty()) {
            const legend = container.append("div")
                .attr("id", "country-legend")
                .attr("class", "legend-box hidden");
            
            legend.append("h3").attr("id", "legend-title").text("Dettagli");
            legend.append("p").html('Voli: <span id="legend-value">-</span>');
            legend.append("p").html('Anno: <span id="legend-year">-</span>');
        }
    }

    const helpContent = {
        title: "How to read the Chart", 
        steps: [
            "<strong>Bar Race:</strong> Watch the evolution of air traffic over time.",
            "<strong>Length:</strong> Represents the total number of incoming flights.",
            "<strong>Colors:</strong> Each country has a distinct color for tracking."
        ]
    };

    if (typeof createChartHelp === "function") {
        d3.select("#race-help-container").html("");
        createChartHelp("#race-help-container", "#race-chart-wrapper", helpContent);
    } else {
        const container = d3.select("#race-help-container");
        container.html(`
            <div class="chart-help-trigger" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <div class="chart-help-icon" style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; background: black; color: white; border-radius: 50%; font-family: serif; font-weight: bold; font-style: italic; font-size: 12px;">i</div>
                <span class="chart-help-text" style="font-family: sans-serif; font-weight: 700; font-size: 14px; color: #000;">How to read the chart?</span>
            </div>
            `);
    }

    // ==========================================
    // --- ANIMAZIONE ---
    // ==========================================
    
    // Accettiamo maxVal come parametro per fissare l'asse
    async function runAnimation(maxVal) {
        
        // 4. CONFIGURAZIONE ASSE X FISSO
        // Usiamo il massimo globale diviso 0.75.
        // Questo significa che la barra più lunga possibile arriverà al 75% della larghezza.
        // L'asse non cambia mai durante l'animazione.
        const x = d3.scaleLinear([0, maxVal / 0.75], [margin.left, width - margin.right]);
        
        const y = d3.scaleBand()
            .domain(d3.range(n + 1))
            .rangeRound([margin.top, margin.top + barSize * (n + 1 + 0.1)])
            .padding(0.1);
        
        const exitPosition = margin.top + barSize * (n + 1);
        
        const highlightScale = d3.scaleOrdinal()
            .domain(neigh)
            .range(customPalette);

        const getColor = (name) => highlightScale(name); 

        // Disegniamo l'asse X una volta sola (fuori dal loop)
        svg.select(".axis--top")
           .call(d3.axisTop(x).ticks(width / 120).tickSizeOuter(0).tickSizeInner(-barSize * (n + y.padding()))); 
        svg.select(".axis--top .domain").remove();

        for (const keyframe of keyframes) {
            const transition = svg.transition().duration(duration / k).ease(d3.easeLinear);
            const [date, data] = keyframe;

            const legendBox = d3.select("#country-legend");
            if(hoveredCountry) {
                const d = data.find(item => item.name === hoveredCountry);
                if(d) {
                    legendBox.classed("hidden", false);
                    d3.select("#legend-title").text(d.name);
                    d3.select("#legend-value").text(d3.format(",d")(d.value));
                    d3.select("#legend-year").text(d3.utcFormat("%Y")(date));
                }
            } else {
                legendBox.classed("hidden", true);
            }

            // NOTA: Non aggiorniamo più x.domain qui. L'asse è fisso.

            svg.select(".bars").selectAll("rect")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("rect")
                        .attr("fill", d => getColor(d.name))
                        .attr("height", y.bandwidth())
                        .attr("x", x(0))
                        .attr("y", exitPosition)
                        .attr("width", d => x(d.value) - x(0))
                        .attr("cursor", "pointer")
                        .on("mouseover", (e, d) => { hoveredCountry = d.name; })
                        .on("mouseout", () => { hoveredCountry = null; }),
                    update => update.attr("fill", d => getColor(d.name)),
                    exit => exit.transition(transition).remove()
                        .attr("y", exitPosition)
                        .attr("width", d => x(d.value) - x(0))
                )
                .call(bar => bar.transition(transition)
                    .attr("y", d => y(d.rank))
                    .attr("width", d => x(d.value) - x(0)) // La larghezza cambia, l'asse no -> Effetto movimento
                    .attr("fill-opacity", d => {
                        if (hoveredCountry) return d.name === hoveredCountry ? 1 : 0.3;
                        return 1;
                    })
                );

            svg.select(".labels-name").selectAll("text")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("class", "label-name")
                        .attr("text-anchor", "end") 
                        .attr("x", x(0) - 8)       
                        .attr("y", y.bandwidth() / 2)
                        .attr("dy", "0.1em")
                        .text(d => d.name)
                        .attr("transform", d => `translate(0,${exitPosition})`), 
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("transform", d => `translate(0,${exitPosition})`)
                )
                .call(text => text.transition(transition)
                    .attr("transform", d => `translate(0,${y(d.rank)})`)
                    .style("font-weight", "700") 
                    .style("fill", "#000")       
                );

            svg.select(".labels-value").selectAll("text")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("class", "label-value")
                        .attr("text-anchor", "start")
                        .attr("x", 6) 
                        .attr("y", y.bandwidth() / 2)
                        .attr("dy", "0.1em")
                        .text(d => d3.format(",d")(d.value))
                        .attr("transform", d => `translate(${x(d.value)},${exitPosition})`),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("transform", d => `translate(${x(d.value)},${exitPosition})`)
                )
                .call(text => text.transition(transition)
                    .attr("transform", d => `translate(${x(d.value)},${y(d.rank)})`)
                    .tween("text", function(d) {
                        const i = d3.interpolateNumber(this.textContent.replace(/,/g, "") || 0, d.value);
                        return function(t) { this.textContent = d3.format(",d")(i(t)); };
                    })
                );

            svg.select(".year-ticker").text(d3.utcFormat("%Y")(date));
            
            await transition.end();
        }
    }

    // Funzione Replay aggiornata per usare il massimo memorizzato
    window.replay = function() {
        hoveredCountry = null;
        d3.select("#country-legend").classed("hidden", true);
        svg.selectAll("*").remove();
        d3.select("#chart-container svg").attr("viewBox", [0, 0, width, height]);
        renderStaticElements();
        runAnimation(storedGlobalMax); // Usiamo lo stesso asse X della prima volta
    };

}
