// File: utils.js

/**
 * Gestisce la creazione del bottone Help e dell'Overlay.
 * Supporta due modalità:
 * 1. AUTOMATICA (2 argomenti): createChartHelp("#mapId", contentObj)
 * - Mette l'overlay dentro #mapId
 * - Mette il bottone nel genitore di #mapId (comportamento classico)
 * * 2. MANUALE (3 argomenti): createChartHelp("#btnContainerId", "#overlayContainerId", contentObj)
 * - Mette il bottone dove dici tu (#btnContainerId)
 * - Mette l'overlay dove dici tu (#overlayContainerId)
 */
function createChartHelp(arg1, arg2, arg3) {
    let triggerContainer, overlayContainer, content;

    // Rilevamento modalità in base al tipo del secondo argomento
    if (typeof arg2 === 'object' && arg3 === undefined) {
        // --- MODALITÀ AUTOMATICA (Compatibilità con Geo Map e altri) ---
        const wrapperId = arg1;
        content = arg2;
        
        overlayContainer = d3.select(wrapperId);
        // Nella modalità automatica, il bottone va nel genitore del wrapper
        triggerContainer = d3.select(overlayContainer.node().parentNode);
        
    } else {
        // --- MODALITÀ MANUALE (Per Front Map) ---
        // arg1 = ID dove mettere il bottone
        // arg2 = ID dove mettere l'overlay (sopra la mappa)
        // arg3 = content
        triggerContainer = d3.select(arg1);
        overlayContainer = d3.select(arg2);
        content = arg3;
    }

    // Controllo sicurezza
    if (triggerContainer.empty() || overlayContainer.empty()) {
        console.error("createChartHelp: Container non trovati.", arg1);
        return;
    }

    // 1. PULIZIA: Rimuovi vecchi elementi per evitare duplicati
    // Rimuoviamo l'overlay dal container mappa
    overlayContainer.selectAll(".chart-help-overlay").remove();
    // Rimuoviamo il bottone dal container controlli
    triggerContainer.selectAll(".chart-help-trigger").remove();

    // 2. CREAZIONE OVERLAY (Il velo bianco con le istruzioni)
    // Deve essere absolute per coprire la mappa
    const overlay = overlayContainer.append("div")
        .attr("class", "chart-help-overlay")
        .style("display", "none")
        .style("position", "absolute")
        .style("top", "0")
        .style("left", "0")
        .style("width", "100%")
        .style("height", "100%")
        .style("z-index", "2000") // Z-index alto
        .style("background", "rgba(255, 255, 255, 0.9)")
        .style("justify-content", "center")
        .style("align-items", "center");

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

    // 3. CREAZIONE TRIGGER (Il bottone "i")
    const trigger = triggerContainer.append("div")
        .attr("class", "chart-help-trigger")
        // Reset margini per garantire allineamento
        .style("margin", "0") 
        .style("padding", "0"); 

    trigger.html(`
        <span class="chart-help-icon">i</span>
        <span class="chart-help-text">How to read the chart?</span>
    `);

    // 4. EVENTI MOUSE
    trigger
        .on("mouseenter", () => overlay.style("display", "flex"))
        .on("mouseleave", () => overlay.style("display", "none"));
}