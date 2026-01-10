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
    const margin = { top: 10, right: 60, bottom: 10, left: 120 }; 

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
        buildHelpOverlay();

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

    const helpContent = [
        { label: "Selezione:", text: "Ucraina e paesi limitrofi." },
        { label: "Barre in corsa:", text: "Traffico aereo totale in arrivo." },
        { label: "Colori:", text: "Scala cromatica personalizzata." }
    ];

    function buildHelpOverlay() {
        const wrapper = document.getElementById('race-chart-wrapper');
        if (!wrapper || document.getElementById('race-help-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'race-help-overlay';
        overlay.className = 'chart-help-overlay';
        const listItems = helpContent.map(item => `<li><strong>${item.label}</strong> ${item.text}</li>`).join('');
        overlay.innerHTML = `<div class="chart-help-box"><h4>Come leggere il grafico</h4><ul>${listItems}</ul></div>`;
        const trigger = wrapper.querySelector('.help-trigger-container');
        if (trigger) trigger.after(overlay); else wrapper.appendChild(overlay);
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

            x.domain([0, data[0].value]);

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