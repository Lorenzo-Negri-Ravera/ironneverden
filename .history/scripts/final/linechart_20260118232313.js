function initFoodChart() {
    const mainContainer = d3.select("#food-chart-container");
    const legendContainer = d3.select("#food-legend-container");
    const helpContainer = d3.select("#food-help-container");

    if (mainContainer.empty()) return;

    // Pulizia totale dei contenitori
    mainContainer.selectAll("*").remove();
    legendContainer.selectAll("*").remove();
    helpContainer.selectAll("*").remove();
    
    mainContainer.style("position", "relative").style("min-height", "400px");

    const margin = {top: 30, right: 30, bottom: 50, left: 60}; 
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = mainContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .style("width", "100%").style("height", "auto")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    d3.csv("../../data/final/data_food.csv").then(function(data) {
        
        // Svuota ancora per sicurezza anti-duplicato
        legendContainer.html(""); 

        const parseTime = d3.timeParse("%Y-%m-%d");
        const keys = data.columns.filter(k => k !== "Date");

        data.forEach(d => {
            d.Date = parseTime(d.Date);
            keys.forEach(k => d[k] = +d[k]);
        });

        // SCALE
        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...keys.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([height, 0]);
        
        const PALETTE = ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        let activeFocusKey = null;

        // ASSI
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0))
            .style("font-family", "sans-serif").style("font-size", "14px");

        svg.append("g")
            .call(d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(12))
            .call(g => g.select(".domain").remove())
            .style("font-family", "sans-serif").style("font-size", "13px");

        // GRIGLIA
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y).ticks(6).tickSize(-width).tickFormat(""))
            .call(g => g.select(".domain").remove())
            .selectAll("line")
            .style("stroke", "#eee")
            .style("stroke-dasharray", "4,4");

        // LINEE
        const lineGen = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key]));

        keys.forEach(key => {
            const safeId = "line-" + key.replace(/\s+/g, '-');
            svg.append("path")
                .datum(data)
                .attr("id", safeId)
                .attr("class", "food-line")
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 3)
                .attr("d", lineGen(key))
                .style("transition", "opacity 0.3s, stroke-width 0.3s")
                .style("cursor", "pointer");
        });

        // FUNZIONE FOCUS
        function updateFocus() {
            svg.selectAll(".food-line")
                .style("opacity", function() {
                    const id = d3.select(this).attr("id");
                    const targetId = "line-" + (activeFocusKey ? activeFocusKey.replace(/\s+/g, '-') : "");
                    return (!activeFocusKey || id === targetId) ? 1 : 0.15;
                })
                .style("stroke-width", function() {
                    const id = d3.select(this).attr("id");
                    const targetId = "line-" + (activeFocusKey ? activeFocusKey.replace(/\s+/g, '-') : "");
                    return (!activeFocusKey || id === targetId) ? 3.5 : 2;
                });

            legendContainer.selectAll(".legend-btn")
                .style("opacity", function() {
                    return (!activeFocusKey || this.__key__ === activeFocusKey) ? 1 : 0.35;
                })
                .style("background", function() {
                    return (activeFocusKey && this.__key__ === activeFocusKey) ? "#f0f0f0" : "transparent";
                });
        }

        // --- CREAZIONE LEGENDA CON DISTANZA MAGGIORE ---
        // column-gap-5 (Bootstrap) o gap: 3rem aumenta lo spazio orizzontale
        legendContainer.attr("class", "d-flex flex-wrap justify-content-center align-items-center mt-4")
            .style("column-gap", "50px") // Spazio orizzontale tra i blocchi
            .style("row-gap", "15px");    // Spazio verticale se vanno a capo

        keys.forEach(key => {
            const btn = legendContainer.append("div")
                .attr("class", "legend-btn d-flex align-items-center gap-2")
                .style("cursor", "pointer")
                .style("padding", "6px 12px") // Spazio interno al tasto
                .style("border-radius", "20px")
                .style("transition", "all 0.2s ease");

            btn.append("span")
                .style("width", "14px").style("height", "14px")
                .style("background-color", color(key))
                .style("border-radius", "50%")
                .style("display", "inline-block");

            btn.append("span")
                .text(key)
                .style("font-size", "14px")
                .style("font-weight", "600")
                .style("color", "#444");

            btn.node().__key__ = key;

            btn.on("click", function() {
                activeFocusKey = (activeFocusKey === key) ? null : key;
                updateFocus();
            });
            
            // Hover effect leggero
            btn.on("mouseover", function() {
                if (!activeFocusKey) d3.select(this).style("background", "#f8f9fa");
            }).on("mouseout", function() {
                if (!activeFocusKey || activeFocusKey !== key) d3.select(this).style("background", "transparent");
            });
        });

        // --- TOOLTIP ---
        const tooltip = d3.select("#food-chart-tooltip");
        const mouseLine = svg.append("line")
            .attr("y1", 0).attr("y2", height)
            .style("stroke", "#ccc").style("stroke-width", "1px").style("stroke-dasharray", "4,4")
            .style("opacity", 0);

        const bisect = d3.bisector(d => d.Date).left;

        svg.append("rect")
            .attr("width", width).attr("height", height)
            .attr("fill", "transparent")
            .on("mousemove", function(event) {
                const xPos = d3.pointer(event)[0];
                const x0 = x.invert(xPos);
                const i = bisect(data, x0, 1);
                const d0 = data[i - 1];
                const d1 = data[i];
                const d = (d1 && x0 - d0.Date > d1.Date - x0) ? d1 : d0;

                mouseLine.attr("x1", x(d.Date)).attr("x2", x(d.Date)).style("opacity", 1);
                
                let html = `<div style="font-weight:bold; color:#333; border-bottom:1px solid #ddd; padding-bottom:4px; margin-bottom:8px;">${d3.timeFormat("%B %Y")(d.Date)}</div>`;
                keys.forEach(k => {
                    const isFocus = !activeFocusKey || activeFocusKey === k;
                    html += `<div style="display:flex; justify-content:space-between; gap:30px; font-size:13px; margin-bottom:3px; opacity:${isFocus ? 1 : 0.3}">
                                <span><b style="color:${color(k)}; font-size:16px; line-height:0;">•</b> ${k}</span>
                                <span style="font-weight:700;">${d[k].toFixed(1)}</span>
                             </div>`;
                });

                tooltip.html(html)
                    .style("visibility", "visible")
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("visibility", "hidden");
                mouseLine.style("opacity", 0);
            });

    }).catch(err => console.error("Errore Food Chart:", err));
}