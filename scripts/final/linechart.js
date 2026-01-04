document.addEventListener("DOMContentLoaded", function() {
    
    // Observer
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                initFoodChart();
                observer.unobserve(entry.target);
            }
        });
    }, options);

    const target = document.querySelector("#chart-section");
    if (target) {
        observer.observe(target);
    } else {
        initFoodChart();
    }
});

function initFoodChart() {
    if (!d3.select("#chart").select("svg").empty()) return;

    // Dimensioni
    const margin = {top: 20, right: 30, bottom: 50, left: 60},
          width = 900 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Caricamento Dati
    d3.csv("../../data/final/data_food.csv").then(function(data) {

        const parseTime = d3.timeParse("%Y-%m-%d");
        const keys = data.columns.filter(k => k !== "Date");

        data.forEach(d => {
            d.Date = parseTime(d.Date);
            keys.forEach(k => d[k] = +d[k]);
        });

        // Scale
        const x = d3.scaleTime()
            .domain(d3.extent(data, d => d.Date))
            .range([0, width]);

        const maxY = d3.max(data, d => Math.max(...keys.map(k => d[k])));
        
        const y = d3.scaleLinear()
            .domain([0, maxY * 1.15])
            .range([height, 0]);

        const color = d3.scaleOrdinal()
            .domain(keys)
            .range(["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948"]);

        // --- DISEGNO ASSI E GRIGLIA ---

        // Asse X
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .attr("class", "axis axis-x")
            .call(d3.axisBottom(x).ticks(8).tickSize(10).tickPadding(10))
            .call(g => g.select(".domain").remove());

        // Asse Y
        svg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y).ticks(6).tickPadding(10))
            .call(g => g.select(".domain").remove());

        // Griglia Orizzontale
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .ticks(6)
                .tickSize(-width)
                .tickFormat("")
            )
            .call(g => g.select(".domain").remove());

        // Linee Curve
        const lineGenerator = (key) => d3.line()
            .curve(d3.curveMonotoneX) 
            .x(d => x(d.Date))
            .y(d => y(d[key]));

        keys.forEach((key) => {
            const safeId = "line-" + key.replace(/\s+/g, '-');

            const path = svg.append("path")
                .datum(data)
                .attr("id", safeId)
                .attr("class", "line")
                .attr("fill", "none")
                .attr("stroke", color(key))
                .attr("d", lineGenerator(key));

            // --- ANIMAZIONE 12 SECONDI ---
            const totalLength = path.node().getTotalLength();

            path
                .attr("stroke-dasharray", totalLength + " " + totalLength)
                .attr("stroke-dashoffset", totalLength)
                .transition()
                .duration(12000) // <--- 12 Secondi (Molto lento)
                .ease(d3.easeCubicOut)
                .attr("stroke-dashoffset", 0);
        });

        // Controlli (Semplificati)
        const controlsDiv = d3.select("#chart-controls-inner");
        controlsDiv.html(""); 

        keys.forEach(key => {
            const safeId = key.replace(/\s+/g, '-');
            const wrapper = controlsDiv.append("label").attr("class", "checkbox-wrapper");
            
            // Rimosso lo style border-left per evitare "lunette" o bordi strani

            wrapper.append("input")
                .attr("type", "checkbox")
                .attr("checked", true)
                .attr("id", "check-" + safeId)
                .on("change", function() {
                    const opacity = this.checked ? 1 : 0;
                    d3.select("#line-" + safeId)
                      .transition().duration(500)
                      .style("opacity", opacity);
                });

            // Coloriamo il testo per indicare a quale linea corrisponde
            wrapper.append("span")
                .text(key)
                .style("color", color(key)) // Testo colorato come la linea
                .style("font-weight", "bold");
        });

        // Tooltip
        const tooltip = d3.select("#chart-tooltip");
        const bisectDate = d3.bisector(d => d.Date).left;
        const mouseG = svg.append("g").attr("class", "mouse-over-effects");
        
        const mouseLine = mouseG.append("path")
            .attr("class", "mouse-line")
            .style("stroke", "#bbb")
            .style("stroke-width", "1px")
            .style("stroke-dasharray", "4,4")
            .style("opacity", "0");

        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("mouseout", () => {
                tooltip.style("display", "none");
                mouseLine.style("opacity", "0");
            })
            .on("mouseover", () => {
                tooltip.style("display", "block");
                mouseLine.style("opacity", "1");
            })
            .on("mousemove", function(event) {
                const mouseX = d3.pointer(event)[0];
                const x0 = x.invert(mouseX);
                const i = bisectDate(data, x0, 1);
                const d0 = data[i - 1];
                const d1 = data[i];
                const d = (!d0 || (d1 && x0 - d0.Date > d1.Date - x0)) ? d1 : d0;

                if (!d) return;

                mouseLine.attr("d", `M${x(d.Date)},0 L${x(d.Date)},${height}`);

                let tooltipHtml = `<div style="margin-bottom:5px; font-weight:bold; font-size:16px;">${d3.timeFormat("%B %Y")(d.Date)}</div>`;
                
                keys.forEach(key => {
                    const safeId = "check-" + key.replace(/\s+/g, '-');
                    const checkbox = document.getElementById(safeId);
                    if (checkbox && checkbox.checked) {
                        tooltipHtml += `<div style="display:flex; justify-content:space-between; align-items:center; width:180px;">
                            <span><span style="color:${color(key)}; font-size:18px;">●</span> ${key}</span>
                            <strong>${d[key].toFixed(1)}</strong>
                        </div>`;
                    }
                });

                tooltip
                    .html(tooltipHtml)
                    .style("left", (event.pageX + 20) + "px")
                    .style("top", (event.pageY - 40) + "px");
            });

    }).catch(err => {
        console.error("Errore dati:", err);
    });
}