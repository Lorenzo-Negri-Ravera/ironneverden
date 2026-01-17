document.addEventListener("DOMContentLoaded", function() {
    console.log("Script inizializzato...");

    const options = { root: null, threshold: 0.1 };
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.target.id === "sub-event-line-section") {
                console.log("Sezione visibile! Avvio initSubEventLineChart...");
                initSubEventLineChart();
                obs.unobserve(entry.target);
            }
        });
    }, options);

    const target = document.querySelector("#sub-event-line-section");
    if (target) observer.observe(target);
    else if(document.querySelector("#sub-event-line-chart-container")) {
        initSubEventLineChart();
    }
});

function initSubEventLineChart() {
    
    // Container selection from HTML 
    const mainContainer = d3.select("#sub-event-line-chart-container");
    const legendContainer = d3.select("#sub-event-legend-container");
    const helpContainer = d3.select("#sub-event-help-container");

    if (mainContainer.empty()) return;

    // Cleaning
    mainContainer.html("").style("position", "relative").style("min-height", "400px");
    legendContainer.html("");
    helpContainer.html("");
    

    // Data & configuration
    const margin = {top: 50, right: 30, bottom: 40, left: 50}; 
    const width = 1000 - margin.left - margin.right;
    const height = 550 - margin.top - margin.bottom;

    d3.csv("../../data/final/front_UKR.csv").then(function(raw_data) {
        
        // Sub-event types to include
        const TARGET_SUB_EVENTS = [
            "Shelling/artillery/missile attack",
            "Air/drone strike",
            "Armed clash"
        ];
        
        // Initial date
        const START_DATE = new Date("2022-02-24"); 
        const parseDate = d3.timeParse("%Y-%m-%d");

        const data = raw_data.map(d => ({
            ...d,
            date: parseDate(d.event_date),
            year: +d.year
        })).filter(d => {
            return d.date >= START_DATE && TARGET_SUB_EVENTS.includes(d.sub_event_type);
        });

        if (data.length === 0) {
            mainContainer.html("<p style='color:red; text-align:center;'>Nessun dato trovato.</p>");
            return;
        }

        const keys = TARGET_SUB_EVENTS; // Fixed order
        const PALETTE = ["#d62728", "#ff7f0e", "#1f77b4"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        // Monthly aggregation
        const monthlyDataMap = d3.rollup(
            data,
            v => {
                const counts = {};
                keys.forEach(key => counts[key] = v.filter(d => d.sub_event_type === key).length);
                return counts;
            },
            d => d3.timeMonth(d.date)
        );
        // Processed data
        const processedData = Array.from(monthlyDataMap, ([date, values]) => ({ Date: date, ...values }))
            .sort((a, b) => a.Date - b.Date);



        // Scales
        const x = d3.scaleTime()
        .domain(d3.extent(processedData, d => d.Date))
        .range([0, width]);

        const maxY = d3.max(processedData, d => Math.max(...keys.map(k => d[k] || 0)));
        
        const y = d3.scaleLinear()
        .domain([0, maxY * 1.1])
        .range([height, 0]);

        // SVG container
        const svg = mainContainer.append("svg")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .style("width", "100%")
            .style("height", "auto")
            .style("display", "block")
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        /* Title: HTML
        svg.append("text")
            .attr("x", width / 2).attr("y", -25).attr("text-anchor", "middle")
            .style("font-family", "'Roboto Slab', serif").style("font-size", "22px").style("font-weight", "700").style("fill", "#25282A")
            .text("Monthly Trends: Shelling, Air Strikes & Clashes");
        */

        // Axes and grid
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0).tickPadding(10))
            .style("font-family", "'Fira Sans', sans-serif")
            .style("font-size", "14px");
        
        svg.append("g").attr("class", "grid")
            .call(d3.axisLeft(y).ticks(8).tickSize(-width).tickFormat(""))
            .call(g => g.select(".domain").remove()) 
            .selectAll("line")
            .style("stroke", "#e0e0e0")
            .style("stroke-dasharray", "4,4")
            // Remotion of horizontal line at y=0
            .filter(d => d === 0) 
            .remove();

        svg.append("g")
            .call(d3.axisLeft(y).ticks(8))
            .call(g => g.select(".domain").remove())
            .style("font-family", "'Fira Sans', sans-serif")
            .style("font-size", "12px");


        // Draw lines
        const lineGenerator = (key) => d3.line().curve(d3.curveMonotoneX).x(d => x(d.Date)).y(d => y(d[key] || 0));
        let activeFocusKey = null; 

        keys.forEach(key => {
            const safeIdLine = "line-" + key.replace(/[^a-zA-Z0-9]/g, '-');
            
            const path = svg.append("path")
                .datum(processedData)
                .attr("id", safeIdLine)
                .attr("class", "line-trace")
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("stroke-width", 2.5)
                .attr("d", lineGenerator(key))
                .style("transition", "opacity 0.3s");
        });


        // Interactive focus update function
        function updateFocusMode() {
            // Lines
            d3.selectAll(".line-trace").transition().duration(200)
                .style("opacity", function() {
                    return (!activeFocusKey || this.id === "line-" + activeFocusKey.replace(/[^a-zA-Z0-9]/g, '-')) ? 1 : 0.15;
                })
                .style("stroke-width", function() {
                    return (!activeFocusKey || this.id === "line-" + activeFocusKey.replace(/[^a-zA-Z0-9]/g, '-')) ? 2.5 : 1.5;
                });

            // Legend
            legendContainer.selectAll("button")
                .style("opacity", function() {
                    return (!activeFocusKey || this.__key__ === activeFocusKey) ? 1 : 0.4;
                });
        }


        // Interactive Legend
        legendContainer.attr("class", "d-flex flex-wrap justify-content-center align-items-center column-gap-5 row-gap-1 mt-2");

        keys.forEach(key => {
            const itemColor = color(key);
            
            // "Button" legend
            const btn = legendContainer.append("button")
                .attr("class", "btn-compact d-flex align-items-center gap-2 p-0 w-auto flex-grow-0 border-0");
            
            // Pallino
            btn.append("span")
                .style("width", "10px").style("height", "10px")
                .style("background-color", itemColor)
                .style("border-radius", "50%")
                .style("display", "inline-block")
                .style("flex-shrink", "0");
            
            // Text
            btn.append("span")
                .text(key)
                .style("font-size", "12px")
                .style("font-weight", "600")
                .style("color", "#25282A")
                .style("white-space", "nowrap");

            btn.on("click", function() {
                activeFocusKey = (activeFocusKey === key) ? null : key;
                updateFocusMode();
            });
            
            btn.node().__key__ = key;
        });


        // How to read the chart
        const helpContent = {
            title: "How to read the Chart",
            steps: [
                "<strong>Y-Axis:</strong> Number of reported events.",
                "<strong>Lines:</strong> Trends over time for specific event types.",
                "<strong>Interaction:</strong> Click the legend to isolate a specific trend."
            ]
        };

        if (typeof createChartHelp === "function") {
            createChartHelp("#sub-event-help-container", "#sub-event-wrapper", helpContent);
        }


        // --- TOOLTIP ---
        // Mouseover effects (as defined in the stacked bar chart)
        const tooltip = d3.select("#sub-event-tooltip");
        const mouseG = svg.append("g").attr("class", "mouse-over-effects");
        const mouseLine = mouseG.append("path")
            .style("stroke", "#555").style("stroke-width", "1px").style("stroke-dasharray", "4,4").style("opacity", "0");

        const bisectDate = d3.bisector(d => d.Date).left;

        svg.append("rect")
            .attr("width", width).attr("height", height)
            .attr("fill", "transparent")
            .attr("pointer-events", "all")
            .on("mouseout", () => { 
                tooltip.style("visibility", "hidden"); 
                mouseLine.style("opacity", "0"); 
            })
            .on("mouseover", () => { 
                tooltip.style("visibility", "visible"); 
                mouseLine.style("opacity", "1"); 
            })
            .on("mousemove", function(event) {
                const mouseX = d3.pointer(event)[0];
                const x0 = x.invert(mouseX);
                const i = bisectDate(processedData, x0, 1);
                const d0 = processedData[i - 1]; const d1 = processedData[i];
                const d = (!d0 || (d1 && x0 - d0.Date > d1.Date - x0)) ? d1 : d0;
                if (!d) return;

                mouseLine.attr("d", `M${x(d.Date)},0 L${x(d.Date)},${height}`);
                
                let html = `<strong>${d3.timeFormat("%B %Y")(d.Date)}</strong><br>`;
                keys.forEach(k => {
                    let opacity = (activeFocusKey && activeFocusKey !== k) ? 0.3 : 1;
                    html += `<div style="opacity:${opacity}; margin-top:4px;">
                        <span style="color:${color(k)}; font-size:12px;">●</span> ${k}: <b>${d[k] || 0}</b>
                    </div>`;
                });
                
                tooltip.html(html)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            });

    }).catch(err => {
        console.error("ERRORE D3:", err);
        mainContainer.html("<p style='color:red; text-align:center'>Errore caricamento dati.</p>");
    });
}