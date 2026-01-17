function initSubEventLineChart() {
    const mainContainer = d3.select("#sub-event-line-chart-container");
    const legendContainer = d3.select("#sub-event-legend-container");
    const helpContainer = d3.select("#sub-event-help-container");
    const tooltip = d3.select("#sub-event-tooltip");

    if (mainContainer.empty()) return;

    // Pulizia
    mainContainer.html("").style("position", "relative").style("min-height", "400px");
    legendContainer.html("");
    helpContainer.html("");

    // Reset stili wrapper (evita conflitti grafici)
    d3.select("#sub-event-wrapper")
      .style("background", "transparent")
      .style("border", "none")
      .style("box-shadow", "none")
      .style("overflow", "visible"); // Importante: visible permette al popover dell'help di uscire dai bordi

    const margin = {top: 40, right: 30, bottom: 40, left: 60}; 
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = mainContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .style("width", "100%").style("height", "auto").style("display", "block")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    d3.json("../../data/final/sub_event_line_chart/sub_event_line_chart.json").then(function(raw_data) {
        const TARGET_TYPES = ["Shelling/artillery/missile attack", "Air/drone strike", "Armed clash"];
        const parseDate = d3.timeParse("%Y-%m-%d");

        // Pivoting
        const dataByWeek = d3.groups(raw_data, d => d.WEEK);
        const data = dataByWeek.map(([weekStr, values]) => {
            const entry = { Date: parseDate(weekStr) };
            TARGET_TYPES.forEach(type => {
                const found = values.find(v => v.SUB_EVENT_TYPE === type);
                entry[type] = found ? +found.EVENTS : 0;
            });
            return entry;
        }).sort((a, b) => a.Date - b.Date);

        // Scale & Palette
        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...TARGET_TYPES.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.15]).range([height, 0]);
        const color = d3.scaleOrdinal().domain(TARGET_TYPES).range(["#d62728", "#ff7f0e", "#1f77b4"]);

        let activeFocusKey = null;

        // Disegno Assi e Griglia
        svg.append("g").attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickFormat(d3.timeFormat("%b %y")).tickSizeOuter(0).tickPadding(10));
        svg.append("g").call(d3.axisLeft(y).ticks(6).tickPadding(10).tickSize(0)).call(g => g.select(".domain").remove());
        svg.append("g").attr("class", "grid")
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat("")).call(g => g.select(".domain").remove())
            .selectAll("line").style("stroke", "#e0e0e0").style("stroke-dasharray", "4,4").filter(d => d === 0).remove();

        // Linee
        const lineGenerator = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key]));
        TARGET_TYPES.forEach(key => {
            svg.append("path").datum(data)
                .attr("id", "line-sub-" + key.replace(/[^a-zA-Z0-9]/g, '-'))
                .attr("class", "line-trace-sub").attr("fill", "none").attr("stroke", color(key))
                .attr("stroke-width", 2.5).attr("d", lineGenerator(key));
        });

        // --- LEGENDA (MATCHING FOOD CHART) ---
        legendContainer.attr("class", "d-flex flex-wrap justify-content-center align-items-center column-gap-5 row-gap-1 mt-1");

        TARGET_TYPES.forEach(key => {
            const btn = legendContainer.append("button").attr("class", "btn-compact d-flex align-items-center gap-2 p-0 w-auto flex-grow-0 border-0 bg-transparent");
            btn.append("span").style("width", "10px").style("height", "10px").style("background-color", color(key)).style("border-radius", "50%");
            btn.append("span").text(key).style("font-size", "12px").style("font-weight", "600").style("color", "#25282A");
            
            btn.on("click", function() {
                activeFocusKey = (activeFocusKey === key) ? null : key;
                d3.selectAll(".line-trace-sub").transition().duration(200)
                    .style("opacity", function() {
                        const id = this.id.replace("line-sub-", "");
                        return (!activeFocusKey || id === key.replace(/[^a-zA-Z0-9]/g, '-')) ? 1 : 0.15;
                    });
            });
        });

        // --- HELP BUTTON ---
        const helpContent = {
            title: "Understanding Conflict Trends",
            steps: [
                "<strong>Y-Axis:</strong> Number of violence events recorded each week.",
                "<strong>Categories:</strong> Shelling, strikes, and direct armed clashes.",
                "<strong>Focus:</strong> Click a legend category to isolate its trend line."
            ]
        };
        if (typeof createChartHelp === "function") {
            createChartHelp("#sub-event-help-container", "#sub-event-wrapper", helpContent);
        }

        // --- TOOLTIP LOGIC ---
        // (Rimani con la logica mouseover/mousemove che abbiamo definito prima)

    });
}