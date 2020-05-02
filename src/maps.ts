import * as am4core from "@amcharts/amcharts4/core";
import * as am4maps from "@amcharts/amcharts4/maps";
import am4themes_animated from "@amcharts/amcharts4/themes/animated";
import am4geodata_worldUltra from "@amcharts/amcharts4-geodata/worldUltra";
import { IVMSpec } from "./IVMSpec.interface";

am4core.useTheme(am4themes_animated);
const container = am4core.create("map", am4core.Container);
container.layout = "vertical";
container.width = am4core.percent(100);
container.height = am4core.percent(100);

// map
const map = container.createChild(am4maps.MapChart);
const switchBetweenGlobeAndMap = map.createChild(am4core.SwitchButton);
switchBetweenGlobeAndMap.align = "right";
switchBetweenGlobeAndMap.marginTop = 20;
switchBetweenGlobeAndMap.marginRight = 20;
switchBetweenGlobeAndMap.valign = "top";
(switchBetweenGlobeAndMap.leftLabel as am4core.Label).text = "Map";
(switchBetweenGlobeAndMap.rightLabel as am4core.Label).text = "Globe";
(switchBetweenGlobeAndMap.leftLabel as am4core.Label).fill = am4core.color(
  "#fff"
);
(switchBetweenGlobeAndMap.rightLabel as am4core.Label).fill = am4core.color(
  "#fff"
);

switchBetweenGlobeAndMap.events.on("toggled", () => {
  if (switchBetweenGlobeAndMap.isActive) {
    map.projection = new am4maps.projections.Orthographic();
    map.panBehavior = "rotateLongLat";
  } else {
    map.projection = new am4maps.projections.Mercator();
    map.panBehavior = "move";
  }
});
try {
  map.geodata = am4geodata_worldUltra;
} catch (e) {
  map.raiseCriticalError(
    new Error(
      "Map geodata could not be loaded. Please download the latest amcharts geodata and extract its contents into the same directory as your amCharts files."
    )
  );
}
map.projection = new am4maps.projections.Mercator();
map.panBehavior = "move";
// prevent dragging
map.seriesContainer.draggable = true;
map.seriesContainer.resizable = false;

const polygonSeries = map.series.push(new am4maps.MapPolygonSeries());
polygonSeries.useGeodata = true;
polygonSeries.exclude = ["AQ"];

const polygonTemplate = polygonSeries.mapPolygons.template;
polygonTemplate.tooltipText = "{name}";
polygonTemplate.fill = am4core.color("#5cc1f8");
polygonTemplate.stroke = am4core.color("#fff");
polygonTemplate.strokeWidth = 0.5;

// images
let imageSeries = map.series.push(new am4maps.MapImageSeries());
let imageTemplate = imageSeries.mapImages.template;
imageTemplate.propertyFields.longitude = "longitude";
imageTemplate.propertyFields.latitude = "latitude";
imageTemplate.nonScaling = true;

let image = imageTemplate.createChild(am4core.Image);
image.propertyFields.href = "imageUrl";
image.width = 32;
image.height = 32;
image.horizontalCenter = "middle";
image.verticalCenter = "middle";

let label = imageTemplate.createChild(am4core.Label);
label.text = "{label}";
label.fill = am4core.color("#fff");
label.horizontalCenter = "middle";
label.verticalCenter = "top";
label.dy = 20;

export function clearResources() {
  imageSeries.data = [];
}
export async function addServer(serverSpec: IVMSpec) {
  let icon = "assets/cloud-computing.svg";
  let location = await reverseGeo(serverSpec.location);
  for (const data of imageSeries.data) {
    if (data.label === serverSpec.name) {
      const index = imageSeries.data.indexOf(data);
      imageSeries.data.splice(index, 1);
    }
  }
  imageSeries.addData({
    latitude: location.lat,
    longitude: location.lon,
    imageUrl: icon,
    width: 32,
    height: 32,
    label: serverSpec.name,
  });
}

async function reverseGeo(loc: string): Promise<{ lat: number; lon: number }> {
  try {
    const res = await fetch(
      "https://nominatim.openstreetmap.org/search?format=json&q=" + loc,
      {
        method: "GET",
        mode: "cors",
      }
    );

    const body = await res.json();

    return {
      lat: Number.parseFloat(body[0].lat),
      lon: Number.parseFloat(body[0].lon),
    };
  } catch (error) {
    throw error;
  }
}
