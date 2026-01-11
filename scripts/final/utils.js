// File: utils.js

/**
 * Gestisce la creazione del bottone Help e dell'Overlay.
 * Logica: JavaScript gestisce solo struttura e visibilità.
 * Stile: Tutto delegato al CSS (classi .chart-help-*).
 */
function createChartHelp(arg1, arg2, arg3) {
    let triggerContainer, overlayContainer, content;

    // 1. Rilevamento modalità (Automatica o Manuale)
    if (typeof arg2 === 'object' && arg3 === undefined) {
        // AUTOMATICA
        const wrapperId = arg1;
        content = arg2;
        overlayContainer = d3.select(wrapperId);
        triggerContainer = d3.select(overlayContainer.node().parentNode);
    } else {
        // MANUALE
        triggerContainer = d3.select(arg1);
        overlayContainer = d3.select(arg2);
        content = arg3;
    }

    if (triggerContainer.empty() || overlayContainer.empty()) {
        console.error("createChartHelp: Container mancanti!", arg1, arg2);
        return;
    }

    // 2. PULIZIA ELEMENTI ESISTENTI
    overlayContainer.selectAll(".chart-help-overlay").remove();
    triggerContainer.selectAll(".chart-help-trigger").remove();

    // 3. FIX POSIZIONAMENTO PADRE
    // Necessario affinché l'overlay absolute si posizioni rispetto al grafico e non alla pagina
    if (overlayContainer.style("position") === "static") {
        overlayContainer.style("position", "relative");
    }

    // 4. CREAZIONE OVERLAY
    // Nota: Usiamo JS per sovrascrivere il "display: none" del CSS quando serve,
    // ma lasciamo che il CSS gestisca background, blur, ecc.
    const overlay = overlayContainer.append("div")
        .attr("class", "chart-help-overlay")
        // --- STILI FUNZIONALI (JS) ---
        .style("visibility", "hidden") // Partiamo nascosti
        .style("opacity", "0")       // Opacità 0 per transizione
        .style("display", "flex")    // Flex per centrare il contenuto (sovrascrive display:none del CSS)
        .style("transition", "opacity 0.2s, visibility 0.2s") // Animazione fluida
        .style("pointer-events", "none"); // Trasparente al mouse

    // 5. CREAZIONE CONTENUTO
    const contentBox = overlay.append("div")
        .attr("class", "chart-help-content");
        // Nessun stile inline qui! Prenderà padding, shadow e radius dal CSS.
    
    // Titolo
    contentBox.append("h4")
        .style("margin-top", "0") // Unico reset utile
        .style("color", "#333")   // Colore base titolo
        .text(content.title || "How to read the chart");

    // DIVIDER (Barretta Rossa)
    // Qui non metto stili. Il CSS .chart-help-divider gestirà:
    // width: 50px, background: #C8102E, margin: 10px auto (centrato)
    contentBox.append("div")
        .attr("class", "chart-help-divider");

    // Lista Istruzioni
    const ul = contentBox.append("ul");

    if (content.steps) {
        content.steps.forEach(step => ul.append("li").html(step));
    }

    // 6. CREAZIONE TRIGGER (BOTTONE)
    // Nessun style inline per flex o gap, ci pensa il CSS .chart-help-trigger
    const trigger = triggerContainer.append("div")
        .attr("class", "chart-help-trigger")
        .style("pointer-events", "auto"); // Assicura che sia cliccabile

    trigger.html(`
        <span class="chart-help-icon">i</span>
        <span class="chart-help-text">How to read the chart?</span>
    `);

    // 7. EVENTI (Logica On/Off)
    trigger.on("mouseenter", function() {
        overlay
            .style("visibility", "visible")
            .style("opacity", "1");
    });

    trigger.on("mouseleave", function() {
        overlay
            .style("visibility", "hidden")
            .style("opacity", "0");
    });
}