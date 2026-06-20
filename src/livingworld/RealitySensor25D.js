function localDaylight(now) {
  const date = now instanceof Date ? now : new Date(now);
  const hour = Number.isFinite(date.getTime()) ? date.getHours() : new Date().getHours();
  const phase = hour >= 6 && hour < 18 ? 'day' : 'night';
  return {
    source: 'local-time',
    phase,
    intensity: phase === 'day' ? 1 : 0.2
  };
}

function geolocationStatus(error) {
  if (!error) return 'granted';
  if (error.code === 1) return 'denied';
  if (error.code === 2) return 'unavailable';
  if (error.code === 3) return 'timeout';
  return 'error';
}

function readOrientation(windowRef) {
  const orientation = windowRef?.deviceOrientation;
  if (orientation && Number.isFinite(Number(orientation.gamma)) && Number.isFinite(Number(orientation.beta))) {
    return {
      source: 'deviceorientation',
      tiltX: Number(orientation.gamma),
      tiltY: Number(orientation.beta)
    };
  }
  if (Number.isFinite(Number(windowRef?.orientation))) {
    return {
      source: 'screen-orientation',
      tiltX: Number(windowRef.orientation),
      tiltY: 0
    };
  }
  return { source: 'unavailable', tiltX: 0, tiltY: 0 };
}

export class RealitySensor25D {
  constructor({
    window: windowRef = globalThis.window,
    navigator: navigatorRef = globalThis.navigator,
    now = () => new Date()
  } = {}) {
    this.window = windowRef;
    this.navigator = navigatorRef;
    this.now = now;
  }

  async sample({ daylight = false, orientation = false, geolocation = false } = {}) {
    const result = {
      permissions: {
        geolocation: geolocation ? 'unavailable' : 'not-requested'
      }
    };

    if (daylight) {
      result.daylight = localDaylight(this.now());
    }

    if (orientation) {
      result.orientation = readOrientation(this.window);
    }

    if (geolocation) {
      const position = await this._sampleGeolocation();
      result.permissions.geolocation = position.permission;
      if (position.coords) {
        result.geolocation = position.coords;
      }
      if (daylight) {
        result.daylight = {
          ...result.daylight,
          source: 'local-time',
          permission: position.permission
        };
      }
    }

    return result;
  }

  _sampleGeolocation() {
    const geolocation = this.navigator?.geolocation;
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
      return Promise.resolve({ permission: 'unavailable', coords: null });
    }

    return new Promise((resolve) => {
      geolocation.getCurrentPosition(
        (position) => resolve({
          permission: 'granted',
          coords: {
            latitude: Number(position?.coords?.latitude),
            longitude: Number(position?.coords?.longitude)
          }
        }),
        (error) => resolve({ permission: geolocationStatus(error), coords: null })
      );
    });
  }
}

export default RealitySensor25D;
