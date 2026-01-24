// File: sunburst.js

(function() {

    const DATA_PATHS = {
        UKR_2021: "../../data/final/trade-data/final_datasets/UKR_export_2021_destinations_v2.json",
        UKR_2023: "../../data/final/trade-data/final_datasets/UKR_export_2023_destinations_v2.json",
        RUS_2021: "../../data/final/trade-data/final_datasets/RUS_export_2021_destinations_v2.json",
        RUS_2023: "../../data/final/trade-data/final_datasets/RUS_export_2023_destinations_v2.json"
    };

    const width = 600; 
    const radius = width / 6;

    const continentColors = {
        "Europe": "#003f5c",   
        "Asia": "#ffa600",     
        "Africa": "#ff6361",   
        "North America": "#bc5090", 
        "South America": "#58508d", 
        "Oceania": "#488f31",  
        //"Unknown": "#bab0ac"   
    };

    const formatMoney = d3.format("$.2s"); 

    let allData = {};
    let currentCountry = "RUS"; 

    document.addEventListener("DOMContentLoaded", function() {
        const target = document.querySelector("#sunburst-section");
        if(target) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        initSunburst();
                        obs.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1 });
            observer.observe(target);
        }
    });

    function initSunburst() {
        const wrapper = d3.select("#sunburst-wrapper");
        wrapper.selectAll(".chart-loader-overlay").remove();
        
        const tooltip = d3.select("#sunburst-tooltip");
        
        if (!tooltip.empty()) {
            document.body.appendChild(tooltip.node());
            tooltip.attr("class", "shared-tooltip")
                   .style("position", "absolute")
                   .style("z-index", "9999");
        }

        const loader = wrapper.append("div")
            .attr("class", "chart-loader-overlay")
            .style("display", "flex");
        loader.append("div").attr("class", "loader-spinner");

        const hideLoader = () => loader.style("display", "none");

        Promise.all([
            d3.json(DATA_PATHS.UKR_2021),
            d3.json(DATA_PATHS.UKR_2023),
            d3.json(DATA_PATHS.RUS_2021),
            d3.json(DATA_PATHS.RUS_2023)
        ]).then(([ukr21, ukr23, rus21, rus23]) => {

            allData = {
                UKR: { 2021: processHierarchy(ukr21), 2023: processHierarchy(ukr23) },
                RUS: { 2021: processHierarchy(rus21), 2023: processHierarchy(rus23) }
            };

            setupControls();
            updateDashboard();
            hideLoader();

        }).catch(err => {
            console.error("Errore Sunburst:", err);
            loader.html(`<div style="color:red">Error loading data</div>`);
        });
    }

    function processHierarchy(flatData) {
        const grouped = d3.group(flatData, d => d.Continent);
        const CUMULATIVE_CUTOFF = 0.90; 

        const children = Array.from(grouped, ([continentName, values]) => {
            
            const continentTotal = d3.sum(values, d => d["Trade Value"]);
            values.sort((a, b) => b["Trade Value"] - a["Trade Value"]);

            let bigCountries = [];
            let otherValue = 0;
            let accumulatedPercent = 0;

            values.forEach(d => {
                const val = d["Trade Value"];
                const ratio = val / continentTotal;
                
                if (accumulatedPercent < CUMULATIVE_CUTOFF) {
                    bigCountries.push({ name: d.Country, value: val });
                    accumulatedPercent += ratio;
                } else {
                    otherValue += val;
                }
            });

            if (otherValue > 0) {
                bigCountries.push({ name: "Other", value: otherValue });
            }

            return { name: continentName, children: bigCountries };
        });

        return { name: "World", children: children };
    }

    function setupControls() {
        const container = d3.select("#sunburst-controls");
        if(container.empty()) return;

        container.attr("class", "compact-menu-bar d-inline-flex align-items-center");
        container.html("");

        const options = [
             { label: "Russia", value: "RUS" },
            { label: "Ukraine", value: "UKR" }
        ];

        options.forEach((opt, index) => {
            const btn = container.append("button")
                .attr("class", "btn-compact")
                .text(opt.label)
                .on("click", function() {
                    container.selectAll(".btn-compact").classed("active", false);
                    d3.select(this).classed("active", true);
                    currentCountry = opt.value;
                    updateDashboard();
                });

            if (opt.value === currentCountry) btn.classed("active", true);
            if (index < options.length - 1) container.append("div").attr("class", "compact-divider");
        });
    }

    function updateDashboard() {
        d3.select("#chart-2021").selectAll("*").remove();
        d3.select("#chart-2023").selectAll("*").remove();

        createZoomableSunburst(allData[currentCountry][2021], "#chart-2021", "#total-label-2021");
        createZoomableSunburst(allData[currentCountry][2023], "#chart-2023", "#total-label-2023");
    }

    function createZoomableSunburst(data, selector, labelSelector) {
        const tooltip = d3.select("#sunburst-tooltip");

        const root = d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => {
                if (a.data.name === "Other") return 1; 
                if (b.data.name === "Other") return -1;  
                return b.value - a.value;
            });

        d3.partition().size([2 * Math.PI, root.height + 1])(root);
        root.each(d => d.current = d);

        const totalValue = root.value;
        const formattedTotal = totalValue ? formatMoney(totalValue).replace("G", "B") : "$0";
        d3.select(labelSelector).text(`Total Export: ${formattedTotal}`);

        const color = d3.scaleOrdinal()
            .domain(Object.keys(continentColors))
            .range(Object.values(continentColors));

        const arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(radius * 1.5)
            .innerRadius(d => d.y0 * radius)
            .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

        const svg = d3.select(selector).append("svg")
            .attr("viewBox", [-width / 2, -width / 2, width, width]) 
            .style("font-family", "'Fira Sans', sans-serif")
            .style("font-size", "15px");
        
        const path = svg.append("g")
            .selectAll("path")
            .data(root.descendants().slice(1))
            .join("path")
            .attr("fill", d => {
                let currentNode = d;
                while (currentNode.depth > 1) currentNode = currentNode.parent;
                return color(currentNode.data.name) || "#ccc";
            })
            .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.8 : 0.6) : 0)
            .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
            .attr("d", d => arc(d.current));

        path.filter(d => d.children)
            .style("cursor", "pointer")
            .on("click", clicked);

        path.on("mouseover", function(event, d) {
            d3.select(this).attr("fill-opacity", 1);

            const breadcrumb = d.ancestors().map(d => d.data.name).reverse().join(" / ");
            const val = formatMoney(d.value).replace("G", "B");

            const htmlContent = `
                <div class="tooltip-header" style="font-size:11px; color:#666; margin-bottom:2px; border-bottom:none;">${breadcrumb}</div>
                <div class="tooltip-row" style="margin-bottom:0;">
                    <span class="tooltip-label" style="font-size:14px; color:#000;">${d.data.name}</span>
                    <span class="tooltip-value" style="font-size:14px;">${val}</span>
                </div>
            `;

            tooltip.html(htmlContent)
                   .style("visibility", "visible")
                   .style("opacity", 1); 
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 15) + "px")
                   .style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", function(event, d) {
            const originalOpacity = arcVisible(d.current) ? (d.children ? 0.8 : 0.6) : 0;
            d3.select(this).attr("fill-opacity", originalOpacity);
            
            tooltip.style("visibility", "hidden")
                   .style("opacity", 0);
        });

        const label = svg.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .style("user-select", "none")
            .selectAll("text")
            .data(root.descendants().slice(1))
            .join("text")
            .attr("dy", "0.35em")
            .attr("fill-opacity", d => +labelVisible(d.current))
            .attr("transform", d => labelTransform(d.current))
            .text(d => {
                const name = d.data.name;
                return name.length > 10 ? name.substring(0, 10) + ".." : name;
            });


        const parent = svg.append("circle")
            .datum(root)
            .attr("r", radius)
            .attr("fill", "none")
            .attr("pointer-events", "all")
            .on("click", clicked);
        
        const closeGroup = svg.append("g")
            .attr("class", "close-btn-group")
            .attr("transform", `translate(${width/2 - 40}, ${-width/2 + 40})`) 
            .style("cursor", "pointer")
            .style("opacity", 0) 
            .style("pointer-events", "none")
            .on("click", (e) => {
                e.stopPropagation(); 
                clicked(null, root);
            });

        closeGroup.append("rect")
            .attr("width", 46).attr("height", 46)
            .attr("x", -23).attr("y", -23)
            .attr("fill", "transparent");

        const fontAttr = {
            "text-anchor": "middle",
            "dy": "0.35em",
            "font-family": "sans-serif",
            "font-weight": "900",
            "font-size": "26px"
        };
        const symbol = "✕";
        const brandDark = "#25282A";

        const outline = closeGroup.append("text").text(symbol);
        Object.entries(fontAttr).forEach(([key, val]) => outline.attr(key, val));
        outline.attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3.5);

        const fill = closeGroup.append("text").text(symbol);
        Object.entries(fontAttr).forEach(([key, val]) => fill.attr(key, val));
        fill.attr("fill", brandDark).attr("stroke", brandDark).attr("stroke-width", 0.5);

        function clicked(event, p) {
            if (!p) p = root;

            parent.datum(p.parent || root);

            root.each(d => d.target = {
                x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                y0: Math.max(0, d.y0 - p.depth),
                y1: Math.max(0, d.y1 - p.depth)
            });

            const t = svg.transition().duration(750);

            const isRoot = (p === root);
            closeGroup.transition(t)
                .style("opacity", isRoot ? 0 : 1)
                .style("pointer-events", isRoot ? "none" : "all");

            path.transition(t)
                .tween("data", d => {
                    const i = d3.interpolate(d.current, d.target);
                    return t => d.current = i(t);
                })
                .filter(function(d) { return +this.getAttribute("fill-opacity") || arcVisible(d.target); })
                .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.8 : 0.6) : 0)
                .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
                .attrTween("d", d => () => arc(d.current));

            label.filter(function(d) { return +this.getAttribute("fill-opacity") || labelVisible(d.target); })
                .transition(t)
                .attr("fill-opacity", d => +labelVisible(d.target))
                .attrTween("transform", d => () => labelTransform(d.current));
        }

        function arcVisible(d) { return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0; }
        function labelVisible(d) { return d.y1 <= 3 && d.y0 >= 1 && (d.x1 - d.x0) > 0.05; }
        function labelTransform(d) {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2 * radius;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        }
    }

    const sunburstHelpContent = {
        title: "How to read the chart?",
        steps: [
            "Observe the major participants in the two economies",
            "Inner Ring: Continents.",
            "Outer Ring: Countries.",
            "Click a region to zoom in, click center to zoom out."
        ]
    };

    if (typeof createChartHelp === "function") {
        createChartHelp("#sunburts-help-container", "#sunburst-wrapper", sunburstHelpContent);
    } 

})();