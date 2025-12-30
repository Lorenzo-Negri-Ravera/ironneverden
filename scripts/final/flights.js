// File: flights.js

const years = [2020, 2021, 2022, 2023, 2024];
const filePaths = years.map(y => `../../data/proj/FlightsUKR/ukraine_flights_${y}.json`);

// Spostiamo le label fuori per pulizia
const biWeeklyLabels = [
    "1 Jan", "15 Jan", "1 Feb", "15 Feb", "1 Mar", "15 Mar",
    "1 Apr", "15 Apr", "1 May", "15 May", "1 Jun", "15 Jun",
    "1 Jul", "15 Jul", "1 Aug", "15 Aug", "1 Sep", "15 Sep",
    "1 Oct", "15 Oct", "1 Nov", "15 Nov", "1 Dec", "15 Dec"
];

Promise.all(filePaths.map(path => d3.json(path))).then(function(allFilesData) {
    
    let rawFullData = [].concat(...allFilesData);

    const fullData = rawFullData.map(d => {
        const dateObj = new Date(d.Day); 
        const year = dateObj.getFullYear();
        const start = new Date(year, 0, 1);
        const dayOfYear = Math.floor((dateObj - start) / 86400000);
        const biweekly_tick = Math.min(23, Math.floor(dayOfYear / 15.21));

        return {
            ...d, date: dateObj, year: year, biweekly_tick: biweekly_tick, value: +d.Flights
        };
    }).filter(d => !isNaN(d.date.getTime())); 

    const aggregatedDetail = d3.rollup(fullData, v => d3.mean(v, d => d.value), d => d.year, d => d.biweekly_tick);

    const overviewData = d3.groups(fullData, d => d3.timeMonth(d.date))
        .map(([date, values]) => ({
            date: date, value: d3.mean(values, d => d.value), division: "Media Voli Mensili"
        })).sort((a, b) => a.date - b.date);

    const width = 1000, height = 600;
    const margin = { top: 60, right: 50, bottom: 100, left: 50 }; 
    const svg = d3.select("#flights-container").attr("viewBox", [0, 0, width, height]);

    // Definiamo le scale come variabili che aggiorneremo
    let x = d3.scaleTime().range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().range([height - margin.bottom, margin.top]);
    const color = d3.scaleOrdinal();

    const gX = svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`);
    const gY = svg.append("g").attr("transform", `translate(${margin.left},0)`);
    const gLines = svg.append("g");
    const title = svg.append("text").attr("x", width/2).attr("y", 20).attr("text-anchor", "middle").attr("class", "graph-title");
    const legendContainer = svg.append("g").attr("class", "legend-container");

    svg.append("defs").append("clipPath").attr("id", "chart-clip")
        .append("rect").attr("width", 0).attr("height", height);
    gLines.attr("clip-path", "url(#chart-clip)");

    function updateChart(mode, selectedYear = 2022) {
        let displayData = [];
        d3.select("#chart-clip rect").interrupt().attr("width", 0);

        if (mode === 'overview') {
            title.text("Andamento Voli Ucraina (Panoramica 2020-2024)");
            
            x = d3.scaleTime().domain(d3.extent(overviewData, d => d.date)).range([margin.left, width - margin.right]);
            y.domain([0, d3.max(overviewData, d => d.value)]).nice();
            color.domain(["Media Voli Mensili"]).range(["#002677"]);
            
            displayData = [{ key: "Media Voli Mensili", values: overviewData }];
            
            gX.transition().duration(750).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));
        } 
        else {
            title.text(`Confronto Bi-settimanale: ${selectedYear} vs 2021`);

            // Cambiamo X in scala lineare per i tick 0-23
            x = d3.scaleLinear().domain([0, 23]).range([margin.left, width - margin.right]);
            
            // ESTRAZIONE DATI (Quello che mancava!)
            const currentYearVals = Array.from(aggregatedDetail.get(+selectedYear) || [], ([t, v]) => ({tick: t, val: v})).sort((a,b) => a.tick - b.tick);
            const ref2021Vals = Array.from(aggregatedDetail.get(2021) || [], ([t, v]) => ({tick: t, val: v})).sort((a,b) => a.tick - b.tick);
            
            y.domain([0, d3.max([...currentYearVals, ...ref2021Vals], d => d.val)]).nice();
            color.domain([`${selectedYear}`, "2021 (Ref)"]).range(["#F1C400", "#A4BCC2"]);
            
            displayData = [
                { key: `${selectedYear}`, values: currentYearVals },
                { key: "2021 (Ref)", values: ref2021Vals }
            ];

            // Configurazione Asse con Label Temporali e rotazione
            gX.transition().duration(750).call(d3.axisBottom(x)
                .ticks(24)
                .tickFormat(d => biWeeklyLabels[d])
            );
            
            gX.selectAll("text")
                .attr("y", 10)
                .attr("x", -5)
                .attr("transform", "rotate(-45)")
                .style("text-anchor", "end");
        }

        // Griglia Y
        gY.transition().duration(750)
            .call(d3.axisLeft(y).ticks(null, "f").tickSize(-(width - margin.left - margin.right)).tickPadding(10))
            .call(g => g.select(".domain").remove())
            .call(g => g.selectAll(".tick line").attr("stroke", "#A4BCC2").attr("stroke-width", 0.5).attr("stroke-dasharray", "3,3"));

        // Generatore Linea aggiornato per gestire i due tipi di dato
        const line = d3.line()
            .x(d => mode === 'overview' ? x(d.date) : x(d.tick))
            .y(d => mode === 'overview' ? y(d.value) : y(d.val))
            .curve(d3.curveMonotoneX);

        const paths = gLines.selectAll(".line-path")
            .data(displayData, d => d.key);

        paths.join("path")
            .attr("class", "line-path")
            .attr("fill", "none")
            .attr("stroke", d => color(d.key))
            .attr("stroke-width", 2) 
            .attr("stroke-dasharray", d => d.key.includes("2021") ? "5,5" : "0")
            .transition().duration(750)
            .attr("d", d => line(d.values));

        d3.select("#chart-clip rect").transition().duration(3000).ease(d3.easeLinear).attr("width", width);
        
        drawLegend(color.domain(), color);
    }

    // Funzione Legenda (Invariata)
    function drawLegend(keys, colorScale) {
        legendContainer.selectAll("*").remove();
        const legendItems = legendContainer.selectAll(".legend-item").data(keys).join("g").attr("class", "legend-item");
        legendItems.append("rect").attr("width", 15).attr("height", 3).attr("y", 4).attr("fill", d => colorScale(d));
        legendItems.append("text").attr("x", 20).attr("y", 10).text(d => d).style("font-size", "12px").style("fill", "#333").attr("dominant-baseline", "middle");

        let currentX = 0;
        legendItems.each(function() {
            d3.select(this).attr("transform", `translate(${currentX}, 0)`);
            currentX += this.getBBox().width + 30;
        });
        legendContainer.attr("transform", `translate(${(width - (currentX - 30))/2}, ${height - margin.bottom + 80})`);
    }

    d3.selectAll(".btn-filter").on("click", function() {
        d3.selectAll(".btn-filter").classed("active", false);
        d3.select(this).classed("active", true);
        updateChart(this.dataset.mode, this.dataset.year);
    });

    updateChart('overview');

    // --- How to read the chart? ---
    setupHelpButton(svg, width, height, {
        x: 30,
        y: height-20,
        title: "Disorders in Europe",
        instructions: [
            "1. Dark intensity means more events.",
            "2. Hover on a country to see the number.",
            "3. Click on a country for details"
        ]
    });

}).catch(err => console.error("Errore:", err));