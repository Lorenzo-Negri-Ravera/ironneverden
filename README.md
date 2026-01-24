
# Data Visualization project
#### Group: IronNeverden
- Barbati Luca, S5082540
- Negri Ravera Lorenzo, S5244911
- Viotti Tommaso, S5048661


#### Web site link: https://lorenzo-negri-ravera.github.io/ironneverden/pages/final/europe_violence.html


### Project structure
All datasets and geographic data used are saved in the main data folder and distributed across the various subfolders depending on the context.
Instead, in the preprocessing folder there are the raw dataset downladed from the websites described in the section below.
The style of our website is entirely managed by the style.css file. Furthermore, the website is composed by only one single page, found in the pages folder. 
Data, pages, and scripts are all included in the corresponding 'final' folder; all the other materials is inherent to the labs during the year. The webpage developed during the year is always accessible through the following ULR: https://lorenzo-negri-ravera.github.io/ironneverden/pages/lab2-6/ukraine_russia_study.html

```text
ironneverden/
├── data/
│   └── final/
│       ├── air_traffic
│       ├── choropleth
│       ├── events_line_chart
│       ├── front_map
│       ├── geojson/
│       │   ├── countries_choropleth
│       │   ├── countries_front_map
│       │   └── europe_final_simplest_v2.geojson
│       ├── spike/
│       │   ├── district
│       │   ├── municipals
│       │   └── region
│       ├── stackedbarchart
│       └── trade-data/
│           └── final_datasets
├── fonts
├── pages/
│   └── final/
│       └── europe_violence.html
├── preprocessing/
│   ├── choropleth
│   ├── event_line
│   ├── food_linechart
│   ├── spike_map
│   ├── stacked_bar_chart
│   └── trade_data
├── scripts/
│   └── final                  
├── index.html
└── style.css
```




### Data sources (where data comes from; links if public)
Datasets:
- ACLED: Disaggregated data on political violence and protests around the world, updated in real time.
- GADM: High-resolution spatial data for all global administrative areas, used to obtain accurate country, regional, and district boundaries on maps.
- FAO: ONU agency from which the Food Price Index was extracted, to analyze monthly fluctuations in international food commodity prices.
- Eurostat: Statistical office of the European Union, used as the official source for data on energy balances and trade flows of member countries.
- OEC: International trade data, essential for analyzing export/import volumes and global economic dynamics.
- Zenodo: Scientific research archive, used to find specific datasets. In our case, it was used to find data on air traffic during the war.

Links:
- ACLED - https://acleddata.com/
- GADM - https://gadm.org/data.html
- FAO - https://www.fao.org/worldfoodsituation/FoodPricesIndex/en
- Eurostat - https://ec.europa.eu/eurostat/web/energy/database
- OEC - https://oec.world/en
- Zenodo - https://zenodo.org/records/7923702

### Data cleaning and imputation (what you changed, fixed, assumed)
For the ACLED dataset, unrecognized countries or small colonized islands were cleaned.
The following columns were also added:
- YEAR: for direct access to the reference year
- ISO: ISO country code used as ID
- GID_1: country's internal region code
Columns not required for the project's analysis and implementation were removed.

For the OEC dataset concerning country imports and exports, only the main categories (70% of the economy) for Russia and Ukraine were retained. All other categories were grouped under 'Other'.

For the Eurostat dataset, columns not relevant to the analysis were removed. Furthermore, country nomenclatures and category codes were standardized, matching the filtered and defined data in the OEC dataset.


### Data processing and analysis 
| Visualization                                                                                                                                              | Chart                       | Dataset  |
|------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------|----------|
| Conflicts and civil unrests for each country and for eache region within the country in Eurasian area.                                                     | Choropleth Map              | ACLED    |
| Focus on the Russian-Ukrainian war: depiction of battles and explosions on the front during the war.                                                       | Scatter Map                 | ACLED    |
| Specific representation of Battles and Explosions events in Ukrainian soil. Detailed geographical representation by regions, districts and municipalities  | Spike Map                   | ACLED    |
| Focus on how the types of events that occurred in Ukraine changed from pre-war to post-war.                                                                | Stacked Normalized Barchart | ACLED    |
| Representation of how military tactics changed during the conflict                                                                                         | Multi-line Chart            | ACLED    |
| Representation of how the export products of Russia and Ukraine changed, pre-war (2021) and war-time (2023)                                                | Slope Chart                 | OEC      |
| Visualization of the change in Russian and Ukrainian export destinations pre-war (2021) and war-time (2023)                                                | Sunburst                    | OEC      |
| Visualization of the changes in the volume and composition of Russian and Ukrainian exports. From raw materials to various destination countries.          | Sankey Diagram              | Eurostat |
| FAO Price Highlight: War Crisis, How Primary Prices Have Changed.                                                                                          | Multi-line Chart            | FAO      |
| Impact and change in gas prices due to the war.                                                                                                            | Histogram o barchart??      | Eurostat |
| Effects on air traffic: Ukrainian airspace closed with the start of the war                                                                                | Bar Chart Race              | Zenodo   |
| Focus on the changing Eurasian air routes                                                                                                                  | Diverging Bar Chart         | Zenodo   |

### Limitations (biases, missing data, uncertainty, methodological constraints)
The general limitation regarding this analysis was due to the recovery of suitable and consistent datasets, especially regarding Russian data.
Focusing on a sensitive topic, we do not know in any case if there is any kind of bias in the data retrieved and used.
Furthermore, using so much data, both geographical and qualitative, a considerable effort was made to standardize all the data so as to have the same nomenclature and codes for a clean and consistent representation.



### Reproducibility documentation




