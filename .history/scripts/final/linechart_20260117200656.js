document.addEventListener("DOMContentLoaded", function() {
    const options = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // 1. Grafico Cibo
                if (entry.target.id === "chart-section") {
                    initFoodChart();
                    observer.unobserve(entry.target);
                }

                // 2. Grafico Sub-Events (Violenza) -> AGGIUNTO QUI
                if (entry.target.id === "sub-event-section") {
                    initSubEventLineChart();
                    observer.unobserve(entry.target);
                }

                // 3. Mappa
                if (entry.target.id === "map-section") {
                    if (typeof initMap === "function") initMap();
                    observer.unobserve(entry.target);
                }
            }
        });
    }, options);

    // Attivazione Observer
    const targets = ["#chart-section", "#sub-event-section", "#map-section"];
    targets.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) observer.observe(el);
    });
});

// --- FUNZIONE SUB EVENTS ---
function initSubEventLineChart() {
    const mainContainer = d3.select("#sub-event-line-chart-container");
    const legendContainer = d3.select("#sub-event-legend-container");
    const helpContainer = d3.select("#sub-event-help-container");
    const tooltip = d3.select("#sub-event-tooltip");

    if (mainContainer.empty()) return;

    // Pulizia
    mainContainer.html("").style("position", "relative");
    legendContainer.html("");
    helpContainer.html("");

    // Configurazione Help
    const helpContent = {
        title: "Analyzing Conflict Events",
        steps: [
            "<strong>Y-axis:</strong> Number of recorded events per week.",
            "<strong>Series:</strong> Differentiation between artillery, air strikes, and clashes.",
            "<strong>Interaction:</strong> Click the legend to isolate a specific event type."
        ]
    };

    // Rendering Help Button
    if (typeof createChartHelp === "function") {
        createChartHelp("#sub-event-help-container", "#sub-event-wrapper", helpContent);
    }

    // ... (resto del codice D3 per il grafico sub-events come già scritto)
}