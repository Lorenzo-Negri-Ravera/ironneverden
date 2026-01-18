document.addEventListener("DOMContentLoaded", function() {
    
    // Flag per prevenire inizializzazioni multiple
    let foodChartInitialized = false;
    
    //Observer configuration
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                
                // Se l'utente scrolla sul Grafico Linee (Cibo)
                if (entry.target.id === "chart-section" && !foodChartInitialized) {
                    console.log("Avvio initFoodChart...");
                    foodChartInitialized = true;
                    initFoodChart();
                    observer.unobserve(entry.target);
                }

                // Se l'utente scrolla sulla Mappa
                if (entry.target.id === "map-section") {
                    console.log("Avvio initMap...");
                    if (typeof initMap === "function") {
                        initMap();
                    } else {
                        console.warn("Funzione initMap non trovata o vuota.");
                    }
                    observer.unobserve(entry.target);
                }
            }
        });
    }, options);

    // Attiviamo l'observer sugli elementi HTML
    const chartTarget = document.querySelector("#chart-section");
    if (chartTarget) observer.observe(chartTarget);

    const mapTarget = document.querySelector("#map-section");
    if (mapTarget) observer.observe(mapTarget);
});


// =============================================================================
// 2. FUNZIONE GRAFICO LINEE (Cibo - Food Price Index)
// =============================================================================
function initFoodChart() {
    // SELEZIONE CONTAINER
    const mainContainer = d3.select("#food-chart-container");
    const legendContainer = d3.select("#food-legend-container");
    const helpContainer = d3.select("#food-help-container");

    if (mainContainer.empty()) return;

    // PULIZIA COMPLETA (importante per evitare duplicati)
    mainContainer.selectAll("*").remove();
    legendContainer.selectAll("*").remove();
    helpContainer.selectAll("*").remove();
    
    mainContainer.style("position", "relative").style("min-height", "400px");

    // Rimuovi stili indesiderati dal wrapper
    d3.select("#food-chart-wrapper").style("background", "transparent").style("border", "none").style("box-shadow", "none");

    // CONFIGURAZIONE
    const margin = {top: 20, right: 30, bottom: 40, left: 50}; 
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // SVG
    const svg = mainContainer.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .style("width", "100%").style("height", "auto").style("display", "block")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // DATI
    d3.csv("../../data/final/data_food.csv").then(function(data) {

        const parseTime = d3.timeParse("%Y-%m-%d");
        const keys = data.columns.filter(k => k !== "Date"); // Le colonne tranne Date sono le serie

        data.forEach(d => {
            d.Date = parseTime(d.Date);
            keys.forEach(k => d[k] = +d[k]);
        });

        // SCALE
        const x = d3.scaleTime().domain(d3.extent(data, d => d.Date)).range([0, width]);
        const maxY = d3.max(data, d => Math.max(...keys.map(k => d[k])));
        const y = d3.scaleLinear().domain([0, maxY * 1.15]).range([height, 0]);
        
        // Colori FAO (Simili a quelli usati)
        const PALETTE = ["#003f5c", "#58508d", "#bc5090", "#ff6361", "#ffa600"];
        const color = d3.scaleOrdinal().domain(keys).range(PALETTE);

        let activeFocusKey = null; // Per la logica di focus

        // ASSI & GRIGLIA
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0).tickPadding(10))
            .style("font-family", "'Fira Sans', sans-serif").style("font-size", "14px");

        svg.append("g")
            .ca