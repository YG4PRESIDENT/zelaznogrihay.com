// Keep polygon caps clear of the ocean at every point between mesh vertices.
export const GLOBE_RENDERING = {
    countryAltitude: .008,
    countryCurvature: 2,
    borderAltitude: .009,
    surfaceCurvature: 2,
    cameraNearRatio: .1,
    cameraFarRatio: 10,
} as const;
