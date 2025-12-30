// File: utils.js

function setupHelpButton(svg, width, height, config) {
    // Valori di default se mancano nella configurazione
    const xPos = config.x ?? 20;
    const yPos = config.y ?? (height - 60);
    const title = config.title ?? "How to interpret this map";
    const instructions = config.instructions ?? [];

    // 1. IL BOTTONE
    const helpButtonGroup = svg.append("g")
        .attr("class", "help-button")
        .attr("cursor", "pointer")
        .attr("transform", `translate(${xPos}, ${yPos})`);

    helpButtonGroup.append("circle")
        .attr("r", 9)
        .attr("fill", "black");

    helpButtonGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("fill", "white")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .text("i");

    helpButtonGroup.append("text")
        .attr("x", 15)
        .attr("dy", "0.35em")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "black")
        .text("How to read the chart?");

    // 2. IL POPUP (Nascosto)
    const popupGroup = svg.append("g")
        .attr("class", "info-popup")
        .style("display", "none")
        .style("pointer-events", "none");

    popupGroup.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "rgba(255, 255, 255, 0.7)");

    const popupWidth = 400;
    const popupHeight = 60 + (instructions.length * 25); // Altezza dinamica in base alle righe
    
    const popupContent = popupGroup.append("g")
        .attr("transform", `translate(${(width - popupWidth) / 2}, ${(height - popupHeight) / 2})`);

    popupContent.append("rect")
        .attr("width", popupWidth)
        .attr("height", popupHeight)
        .attr("fill", "white")
        .attr("stroke", "#333")
        .attr("stroke-width", 2)
        .attr("rx", 8);

    popupContent.append("text")
        .attr("x", popupWidth / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text(title);

    // Inserimento righe di testo dinamiche
    instructions.forEach((text, i) => {
        popupContent.append("text")
            .attr("x", 20)
            .attr("y", 60 + (i * 25))
            .style("font-size", "14px")
            .text(text);
    });

    // 3. INTERAZIONE (Mostra/Nascondi)
    helpButtonGroup.on("mouseenter", () => popupGroup.style("display", "block"));
    helpButtonGroup.on("mouseleave", () => popupGroup.style("display", "none"));
}