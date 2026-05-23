const client = require("openrouteservice-js");

const orsDirections = new client.Directions({
  api_key:
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImNiYWM1NmMxNGY2NDQ2ZTFhYzc5YWQ2NjU1ZGM5NjU3IiwiaCI6Im11cm11cjY0In0=",
});

async function getRealisticRoute(
  start = [78.348916, 17.44008],
  end = [78.45, 17.5],
) {
  const response = await orsDirections.calculate({
    coordinates: [start, end],
    profile: "driving-car",
    format: "geojson",
  });

  // response.features[0].geometry.coordinates has all points on the road
  return response.features[0].geometry.coordinates;
}

module.exports = { getRealisticRoute };
