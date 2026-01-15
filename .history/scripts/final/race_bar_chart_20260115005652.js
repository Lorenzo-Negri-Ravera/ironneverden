
(function() {
    // ==========================================
    // --- CONFIGURAZIONE ---
    // ==========================================
    const path = "../../data/final/FlightsUKR/fly/race_bar.csv"; 
    

    // Mappa per convertire i codici in nomi completi
    const codeToName = {
        "UA": "Ukraine", "RU": "Russia", "PL": "Poland", "RO": "Romania", 
        "HU": "Hungary", "SK": "Slovakia", "LT": "Lithuania",
        "MD": "Moldova", "BY": "Belarus", "DE": "Germany", "TR": "Turkey"
        // Aggiungi altri se necessario...
    };

    const duration = 20000; 
    const k = 10;           
    const width = 1000;
    const barSize = 48;
    const margin = { top: 16, right: 6, bottom: 6, left: 160 }; 

    const customPalette = ["#003f5c", "#374c80", "#7a5195", "#bc5090", "#ef5675", "#ff764a", "#ffa600"];
    const neigh = ["Russia", "Ukraine", "Poland", "Hungary", "Romania", "Lithuania", "Slovakia"];

    // Variabili Locali
    let n, height, svg, keyframes;
    let globalMax; 

    // ==========================================
    // --- CARICAMENTO DATI (IBRIDO) ---
    // ==========================================
    d3.csv(path).then(function(rawData) {

        // 1. Trasformiamo i dati "sporchi" in dati puliti
        let data = processHybridData(rawData);

        // 2. Filtriamo solo se necessario (il file sembra già filtrato, ma per sicurezza)
        data = data.filter(d => neigh.includes(d.name));

        if (data.length === 0) {
            console.error("Race Chart: Dati vuoti.");
            return;
        }

        const names = new Set(data.map(d => d.name));
        n = names.size;
        height = margin.top + barSize * n + margin.bottom;
        
        // Calcolo massimo per asse fisso
        globalMax = d3.max(data, d => d.value);

        const dateValues = Array.from(d3.rollup(data, ([d]) => d.value, d => d.date, d => d.name))
            .map(([date, data]) => [new Date(date), data])
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
        if(kb) keyframes.push([new Date(kb), rank(name => b.get(name) || 0, names)]);

        initChart();
        runAnimation();

    }).catch(err => {
        console.error("ERRORE CARICAMENTO:", err);
        d3.select("#chart-container").html(`<p style="color:red; text-align:center;">Errore caricamento: ${path}</p>`);
    });


    // ==========================================
    // --- LOGICA DI DISEGNO ---
    // ==========================================
    function initChart() {
        d3.select("#chart-container svg").remove();
        svg = d3.select("#chart-container").append("svg")
            .attr("viewBox", [0, 0, width, height]);

        svg.append("g").attr("class", "axis axis--top").attr("transform", `translate(0,${margin.top})`);
        svg.append("g").attr("class", "bars");
        svg.append("g").attr("class", "labels-name");
        svg.append("g").attr("class", "labels-value");
        
        svg.append("text")
            .attr("class", "year-ticker")
            .attr("x", width - 60).attr("y", height - 30)
            .style("font-size", "40px").style("opacity", 0.6)
            .style("font-weight", "bold").attr("text-anchor", "end")
            .text("");
    }

    async function runAnimation() {
        const x = d3.scaleLinear([0, globalMax], [margin.left, width - margin.right]);
        const y = d3.scaleBand()
            .domain(d3.range(n + 2))
            .rangeRound([margin.top, margin.top + barSize * (n + 2 + 0.1)])
            .padding(0.1);
        
        const colorScale = d3.scaleOrdinal(customPalette).domain(neigh);
        const getColor = (name) => colorScale(name) || "#ccc";
        const formatNumber = d3.format(",d");
        const formatDate = d3.utcFormat("%B %Y"); 

        svg.select(".axis--top")
            .call(d3.axisTop(x).ticks(width / 160).tickSizeOuter(0).tickSizeInner(-barSize * (n + y.padding())));
        svg.select(".axis--top .domain").remove();

        for (const keyframe of keyframes) {
            const transition = svg.transition().duration(duration / keyframes.length).ease(d3.easeLinear);
            const [date, data] = keyframe;

            svg.select(".bars").selectAll("rect")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("rect")
                        .attr("fill", d => getColor(d.name))
                        .attr("height", y.bandwidth())
                        .attr("x", x(0))
                        .attr("y", d => y(n + 1))
                        .attr("width", d => x(d.value) - x(0)),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("y", d => y(n + 1))
                        .attr("width", d => x(d.value) - x(0))
                )
                .call(bar => bar.transition(transition)
                    .attr("y", d => y(d.rank))
                    .attr("width", d => x(d.value) - x(0))
                    .attr("fill", d => getColor(d.name))
                );

            svg.select(".labels-name").selectAll("text")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("text-anchor", "end")
                        .attr("x", margin.left - 10)
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                        .attr("dy", "0.35em")
                        .text(d => d.name),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                )
                .call(text => text.transition(transition)
                    .attr("y", d => y(d.rank) + y.bandwidth() / 2)
                    .style("font-weight", "bold")
                );

            svg.select(".labels-value").selectAll("text")
                .data(data.slice(0, n), d => d.name)
                .join(
                    enter => enter.append("text")
                        .attr("text-anchor", "start")
                        .attr("x", d => x(d.value) + 6)
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                        .attr("dy", "0.35em")
                        .text(d => formatNumber(d.value)),
                    update => update,
                    exit => exit.transition(transition).remove()
                        .attr("x", d => x(d.value) + 6)
                        .attr("y", d => y(n + 1) + y.bandwidth() / 2)
                )
                .call(text => text.transition(transition)
                    .attr("x", d => x(d.value) + 6)
                    .attr("y", d => y(d.rank) + y.bandwidth() / 2)
                    .tween("text", function(d) {
                        const i = d3.interpolateNumber(this.textContent.replace(/,/g, "") || 0, d.value);
                        return function(t) { this.textContent = formatNumber(i(t)); };
                    })
                );

            svg.select(".year-ticker").text(formatDate(date));
            await transition.end();
        }
    }

    // ==========================================
    // --- FUNZIONE DI SUPPORTO (CRUCIALE) ---
    // ==========================================
    // Questa funzione legge il tuo file CSV "ibrido" e lo trasforma
    function processHybridData(data) {
        const output = [];
        const years = [2019, 2020, 2021, 2022]; 

        data.forEach(row => {
            const destCode = row.destination_name;
            const destName = codeToName[destCode] || destCode; 
            const monthIndex = parseInt(row.mese_id) - 1;

            if (isNaN(monthIndex)) return; 

            years.forEach(year => {
                const colName = `flights_${year}`; 
                const val = parseFloat(row[colName]);

                if (!isNaN(val)) {
                    output.push({
                        name: destName,
                        date: new Date(year, monthIndex, 1),
                        value: val
                    });
                }
            });
        });
        return output.sort((a, b) => a.date - b.date);
    }

    function rank(value, names) {
        const data = Array.from(names, name => ({name, value: value(name)}));
        data.sort((a, b) => d3.descending(a.value, b.value));
        for (let i = 0; i < data.length; ++i) data[i].rank = Math.min(n, i);
        return data;
    }

    window.replayRace = function() {
        if(svg && keyframes) {
            svg.selectAll("*").interrupt(); 
            initChart();
            runAnimation();
        }
    };

})();

