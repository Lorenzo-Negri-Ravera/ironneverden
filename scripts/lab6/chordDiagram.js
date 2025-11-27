// chordDiagram.js

/*
const CHORD_PATH = '../../data/lab6/chord_data_fatalities_country.json';


d3.json(CHORD_PATH).then(function(data) {

    // Dimensioni
    const width = 800;
    const height = 800;
    const innerRadius = 250;
    const outerRadius = 270;

    const svg = d3.select("#chord-container")
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; font: 12px sans-serif;");

    const matrix = data.matrix;
    const names = data.names;
    const numCountries = data.meta.num_countries; // Numero di paesi (i primi N elementi)

    // Layout Chord
    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending)
        (matrix);

    // Scala Colori:
    // - I Paesi (primi N) avranno colori distinti
    // - Gli Eventi (da N in poi) saranno grigi per non distrarre
    const color = d3.scaleOrdinal()
        .domain(names)
        .range(names.map((d, i) => {
            if (i < numCountries) return d3.schemeTableau10[i % 10]; // Colore per i Paesi
            return "#ccc"; // Grigio per gli Eventi
        }));

    // Gruppo esterno (Archi)
    const group = svg.append("g")
        .selectAll("g")
        .data(chord.groups)
        .join("g");

    // Disegna gli archi
    group.append("path")
        .attr("fill", d => color(names[d.index]))
        .attr("stroke", d => d3.rgb(color(names[d.index])).darker())
        .attr("d", d3.arc().innerRadius(innerRadius).outerRadius(outerRadius));

    // Etichette (Testo)
    group.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", ".35em")
        .attr("transform", d => `
            rotate(${(d.angle * 180 / Math.PI - 90)})
            translate(${outerRadius + 10})
            ${d.angle > Math.PI ? "rotate(180)" : ""}
        `)
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
        .text(d => names[d.index])
        .style("font-weight", "bold");

    // Corde (Ribbons)
    svg.append("g")
        .attr("fill-opacity", 0.7)
        .selectAll("path")
        .data(chord)
        .join("path")
        .attr("d", d3.ribbon().radius(innerRadius))
        .attr("fill", d => color(names[d.source.index])) // Colora la corda come il paese d'origine
        .attr("stroke", d => d3.rgb(color(names[d.source.index])).darker());

}).catch(err => console.error("Errore caricamento JSON:", err));
*/

// File: chordDiagram.js

// 1. MODIFICA IL PERCORSO: Punta al file generato per l'Ucraina (Events vs Regions)
const CHORD_PATH = '../../data/lab6/chord_data_ukraine_events.json'; 

d3.json(CHORD_PATH).then(function(data) {

    // --- CONTROLLO DI SICUREZZA ---
    console.log("Dati caricati:", data);
    if (!data.meta) {
        console.error("ERRORE: Manca il campo 'meta'. Hai generato il JSON nuovo?");
        return; 
    }

    // Dimensioni del grafico
    const width = 800;
    const height = 800;
    const innerRadius = 250;
    const outerRadius = 270;

    const svg = d3.select("#chord-container")
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; font: 12px sans-serif;");

    const matrix = data.matrix;
    const names = data.names;
    
    // 2. RECUPERA IL NUOVO METADATO
    // "num_event_types" ci dice quanti sono gli eventi nella lista, prima che inizino le regioni.
    const numEventTypes = data.meta.num_event_types; 

    // Layout Chord
    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending)
        (matrix);

    // 3. LOGICA COLORI AGGIORNATA
    // - I Tipi di Evento (i primi N elementi) avranno colori diversi.
    // - Le Regioni (da N in poi) saranno tutte grigio chiaro.
    const color = d3.scaleOrdinal()
        .domain(names)
        .range(names.map((d, i) => {
            if (i < numEventTypes) {
                // Usa una palette vivida per i tipi di evento (Explosions, Battles, ecc.)
                return d3.schemeCategory10[i % 10]; 
            }
            // Usa grigio per le Regioni (Donetsk, Kyiv, ecc.) per non confondere
            return "#ccc"; 
        }));

    // --- DISEGNO DEGLI ARCHI ESTERNI (LABEL) ---
    const group = svg.append("g")
        .selectAll("g")
        .data(chord.groups)
        .join("g");

    // L'arco colorato
    group.append("path")
        .attr("fill", d => color(names[d.index]))
        .attr("stroke", d => d3.rgb(color(names[d.index])).darker())
        .attr("d", d3.arc().innerRadius(innerRadius).outerRadius(outerRadius));

    // Il testo (Label)
    group.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", ".35em")
        .attr("transform", d => `
            rotate(${(d.angle * 180 / Math.PI - 90)})
            translate(${outerRadius + 10})
            ${d.angle > Math.PI ? "rotate(180)" : ""}
        `)
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
        .text(d => names[d.index])
        .style("font-weight", "bold");

    // --- DISEGNO DELLE CORDE INTERNE (RIBBONS) ---
    svg.append("g")
        .attr("fill-opacity", 0.7)
        .selectAll("path")
        .data(chord)
        .join("path")
        .attr("d", d3.ribbon().radius(innerRadius))
        // Colora la corda in base alla sorgente (l'Evento)
        .attr("fill", d => color(names[d.source.index])) 
        .attr("stroke", d => d3.rgb(color(names[d.source.index])).darker())
        
        // Tooltip semplice
        .append("title")
        .text(d => `${names[d.source.index]} -> ${names[d.target.index]}\nEventi: ${d.source.value}`);

}).catch(err => console.error("Errore caricamento JSON:", err));