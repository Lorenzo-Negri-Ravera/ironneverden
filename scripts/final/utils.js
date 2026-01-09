// File: utils.js

function createChartHelp(wrapperId, content) {
    const wrapper = d3.select(wrapperId);
    
    if (wrapper.empty()) {
        console.error("Wrapper non trovato:", wrapperId);
        return;
    }

    // Pulisci vecchi elementi
    wrapper.selectAll(".chart-help-overlay").remove();
    const parent = d3.select(wrapper.node().parentNode);
    parent.selectAll(".chart-help-trigger").remove();

    // 1. Crea OVERLAY
    const overlay = wrapper.append("div")
        .attr("class", "chart-help-overlay")
        .style("display", "none"); // Assicurati che sia nascosto di default

    const contentBox = overlay.append("div").attr("class", "chart-help-content");
    
    contentBox.append("h4")
        .style("margin", "0")
        .style("color", "#333")
        .text(content.title || "How to read the chart");

    contentBox.append("div").attr("class", "chart-help-divider");

    const ul = contentBox.append("ul");
    if (content.steps) {
        content.steps.forEach(step => ul.append("li").html(step));
    }

    // 2. Crea TRIGGER
    const trigger = parent.append("div").attr("class", "chart-help-trigger");
    trigger.html(`
        <span class="chart-help-icon">i</span>
        <span class="chart-help-text">How to read the chart?</span>
    `);

    // 3. Eventi Mouse
    trigger
        .on("mouseenter", () => overlay.style("display", "flex"))
        .on("mouseleave", () => overlay.style("display", "none"));
}