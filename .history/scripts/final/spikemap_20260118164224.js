const data = [];
            agg.forEach((v, k) => {
                // MODIFICA: Visualizza solo se il totale delle vittime è strettamente maggiore di 0
                if (v.val > 0) { 
                    let px, py;
                    if (v.lat && v.lon) { 
                        const p = projection([v.lon, v.lat]); 
                        if (p) [px, py] = p; 
                    }
                    else if (currentCentroids.has(k)) { 
                        const c = currentCentroids.get(k); 
                        [px, py] = c; 
                    }
                    
                    if (px !== undefined) {
                        // Logica Colore Dinamico
                        const bVal = v.dets["Battles"] || 0;
                        const eVal = v.dets["Explosions/Remote violence"] || 0;
                        const spikeColor = (eVal > bVal) ? COLOR_EXPLOSIONS : COLOR_BATTLES;
                        const strokeColor = (eVal > bVal) ? STROKE_EXPLOSIONS : STROKE_BATTLES;

                        data.push({ 
                            name: k, value: v.val, count: v.count, details: v.dets, 
                            x: px, y: py, color: spikeColor, stroke: strokeColor 
                        });
                        if (v.val > maxVal) maxVal = v.val;
                    }
                }
            });