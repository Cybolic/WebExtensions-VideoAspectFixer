const KEY_BORDER = 'Z';

const RATIOS = {
  '16:9' : 0.5625,
  '2:1'  : 0.5,                // Univisium
  '21:9' : 0.4186046511627907, // (1440.0 / 3440.0)
  // '2.76' : 0.3623188405797102 // Ultra Panavision 70 (not very used, not very usable)
};
const RATIO_ORDER = [null, '16:9', '2:1', '21:9'];

const ORIGINAL_STYLES = {};
const STYLESHEET_RULES = {};
let STYLESHEET;

const SITE_TWEAKS = {
  apply: function (video_element_or_selector, css_properties, properties) {
    // Iterate our known sites and stop when one is detected
    // If one is detected, apply any custom HTMLVideoElement styles  and tweaks
    let tweak_applied = Object.keys(SITE_TWEAKS.sites).some(function (site) {
      if (document.querySelector(SITE_TWEAKS.sites[site].detector) != null) {
        let site_options = SITE_TWEAKS.sites[site];

        let element;
        if (site_options['video'] && site_options['video'].selector) {
          element = document.querySelector(site_options['video'].selector);
        }
        // If a video override selector wasn't found or usable,
        // then use the provided element/selector
        if (element == null) {
          element = video_element_or_selector;
        }

        if (element) {
          let css;
          if (site_options['video'] && site_options['video'].modify) {
            css = site_options['video'].modify(css_properties, properties);
          } else {
            css = css_properties;
          }

          if (css != null && Object.keys(css).length) {
            setStyle(`${site}-video`, element, css);
          }

          // Run any defined tweak function
          if (site_options['tweak']) {
            site_options['tweak'](element, css_properties, properties);
          }
        }

        return true;
      } else {
        return false;
      }
    });
    // If no sites were detected, use the given styles as is
    if (tweak_applied === false) {
      setStyle('video', video_element_or_selector, css_properties);
    }
  },
  // Set all styles back to their original state
  remove: function () {
    Object.keys(SITE_TWEAKS.sites).some(function (site) {
      Object.keys(ORIGINAL_STYLES).forEach(function (key) {
        restoreStyle(key);
      })
    });
  },
  sites: {
    'vimeo': {
      detector: 'video[src*="/vimeo.com/"]',
      area: {
        selector : '.js-player_area-wrapper'
      },
      video: {
        modify : function (css_properties, properties) {
          css_properties['transform'] = `translate(0px, ${properties.offset_y}px)`;
          return css_properties;
        }
      },
      tweak: function (video_element_or_selector, css_properties, properties) {
        setTimeout(function () {
          setStyleRule('vimeo-container', '.player_area .player_container',
            `width: ${Math.round(properties.width)}px !important;`
          );
          setStyleRule('vimeo-layout', '.vp-player-layout',
            `left: 0px !important; right: 0px !important;`
          );
        }, 50);
      }
    },
    'netflix': {
      detector: 'video[src*="/www.netflix.com/"]',
      area: {
        selector : '.nfp .nfp.nf-player-container'
      },
      video: {
        modify : function (css_properties, properties) {
          css_properties['transform'] = 'inital';
          css_properties['left']      = `${properties.offset_x}px`;
          return css_properties;
        }
      }
    },
    'youtube': {
      detector: 'video[src*="/www.youtube.com/"]',
      area : {
        selector : '.ytd-app #player-container .html5-video-player',
        notification: {
          useTopPosition: false
        }
      },
      video: {
        modify : function (css_properties, properties) {
          css_properties['left'] = '0px';
          return css_properties;
        }
      }
    },
    'imdb' : {
      detector: 'video[src*=".media-imdb.com"]',
      area : {
        selector : '.airy-renderer-container'
      }
    }
  }
};


function showMiniNotification (text, view_size) {
  let element;
  element = document.createElement('div');
  element.class    = 'ultrawidevideofix-notification';
  let style = 'position: absolute; ';
  if (view_size.notification && view_size.notification.useTopPosition) {
    style += `top: ${view_size.top + 8}px; `;
  } else {
    style += `top: 8px; `;
  }
  style += `left: ${view_size.width / 2}px; width: 6rem; margin-left: -3rem; z-index: 999999; transform: translate3d(0px, 0px, 100px); color: lightgreen; font-family: monospace; font-size: 1.5rem; text-align: center; text-shadow: -1px -1px 1px black, 1px -1px 1px black, 1px 1px 1px black, -1px 1px 1px black; opacity: 0.9;`;
  element.style = style;
  element.textContent = text;
  requestAnimationFrame( () => {
    view_size.area_element.appendChild(element);
    requestAnimationFrame(() => {
      element.style = `${element.style.cssText} transition-property: opacity; transition-duration: 0.5s; transition-timing-function: linear; transition-delay: 0.5s; opacity: 0.0;`
    });
    setTimeout(() => { try { element.remove() } catch (error) {} }, 1000);
  });
}

function getViewSize () {
  let size = {
    width               : window.top.innerWidth,
    height              : window.top.innerHeight,
    top                 : 0,
    area_element        : document.body,
    relativePositioning : false
  };
  Object.keys(SITE_TWEAKS.sites).some(function (site) {
    if (SITE_TWEAKS.sites[site].area && SITE_TWEAKS.sites[site].area.selector) {
      let element = document.querySelector(SITE_TWEAKS.sites[site].area.selector);
      if (element) {
        size = {
          width               : element.clientWidth,
          height              : element.clientHeight,
          top                 : element.getBoundingClientRect().top,
          area_element        : element,
          relativePositioning : SITE_TWEAKS.sites[site].area.relativePositioning || false
        };
        return true;
      }
    }
    return false;
  });
  return size;
}

function getVisibleFraction (element) {
  let rect = element.getBoundingClientRect();
  return Math.min(1.0, rect.bottom / document.documentElement.clientHeight) - Math.max(0.0, rect.top / document.documentElement.clientHeight);
}

function isElementOnScreen (element) {
  return element.getBoundingClientRect().bottom >= 0;
}

function isElementVisible (element) {
  let style;
  if (element === document) return true;
  if (
    (!element || !element.parentNode) ||
    (element.style && (
      element.style.display === 'none' ||
      element.style.visibility === 'none'
    ))
  ) return false;

  style = window.getComputedStyle(element, "");
  if (style && (
    style.display === 'none' ||
    style.visibility === 'none'
  )) return false;

  return isElementVisible(element.parentNode);
}

function findVisibleVideoElement () {
  let video_elements = Array.from(
    document.getElementsByTagName('video')
  )
  .filter(isElementOnScreen)
  .filter(isElementVisible);

  if (video_elements.length) {
    if (video_elements.length > 1) {
      // Pick the video element with the most visible screen estate
      video_elements.sort( (a, b) => getVisibleFraction(b) - getVisibleFraction(a) );
      return video_elements[0];
    } else {
      return video_elements[0];
    }
  } else {
    return null;
  }
}

/**
 * Get the set style properties for an element.
 * Unlike CSSStyleDeclaration, only existing properties are set.
 * @param {HTMLElement} element 
 * @returns {object}    A standard object containing the set style properties for element
 */
function getStyle (element) {
  if (element.style.length) {
    return Object.assign( ...Array.from(Array(element.style.length)).map( (ignore, index) => {
      let property = element.style.item(index);
      return { [property] : element.style[property] };
     }));
  } else {
    return {};
  }
}

/**
 * Apply a number of style properties to an element
 * and save the original styles, if they haven't already been saved.
 * @param {string}             key             The key under which to store the existing styling, if needed
 * @param {string|HTMLElement} selector        The element, or the CSS selector to get the element, to style
 * @param {object}             css_properties  The CSS properties to set with the values to set them as
 */
function setStyle (key, selector, css_properties) {
  let element;
  if (typeof selector === 'object') {
    element = selector;
  } else {
    element = document.querySelector(selector);
  }
  if (element) {
    // Store the current css property values
    // but only if they're not already stored, so we don't accidentally store our modified values
    if (ORIGINAL_STYLES[key] === undefined) {
      ORIGINAL_STYLES[key] = {
        element: element,
        style: getStyle(element)
      };
    }
    // Now set our values
    Object.keys(css_properties).forEach(function (property) { element.style[property] = css_properties[property]; });
    // Set our properties to be important
    element.style = element.style.cssText.replace(
      new RegExp(`((${Object.keys(css_properties).join('|')}) ?:.*?);`),
      '$1 !important;'
    );
  }
}

/**
 * Restore the saved style properties of an element.
 * @param {string}             key       The key from which to restore the styling, if it exists
 * @param {string|HTMLElement} selector  The element, or the CSS selector to get the element, to style
 */
function restoreStyle (key) {
  if (ORIGINAL_STYLES[key]) {
    // Only reset the element's styles if we know what they were
    if (ORIGINAL_STYLES[key].element) {
      let element = ORIGINAL_STYLES[key].element;
      // Reset the element's css properties
      element.style.cssText = '';
      // Set the original css property values
      let original_styles = ORIGINAL_STYLES[key].style || {};
      Object.keys(original_styles).forEach(function (property) { element.style[property] = original_styles[property]; });
    }
  }
  // Now remove the stored css property values
  // so they can be updated next time the style is changed
  if (ORIGINAL_STYLES[key] !== undefined) {
    delete ORIGINAL_STYLES[key];
  }
};

function addStyleRule (key, selector, rules) {
  if (STYLESHEET == null) {
    let element = document.createElement('style');
    element.id  = 'ultrawidevideofix-style';
    document.head.appendChild(element);
    STYLESHEET = element.sheet;
  }
  STYLESHEET.insertRule(`${selector} { ${rules} }`, 0);
  Object.keys(STYLESHEET_RULES).forEach(key => STYLESHEET_RULES[key] += 1);
  STYLESHEET_RULES[key] = 0;
}

function removeStyleRule (key) {
  if (STYLESHEET_RULES[key] != null) {
    STYLESHEET.deleteRule(STYLESHEET_RULES[key])
    STYLESHEET_RULES[key] = undefined;
  }
}

function setStyleRule (key, selector, rules) {
  removeStyleRule(key);
  addStyleRule(key, selector, rules);
}


class VideoElement {
  constructor () {
    this.element = null;
    this.fullscreen = false;
    this.current_ratio = null;
    // Bind event handlers to scope
    this.handlers = {
      init          : this.init.bind(this),
      onKey         : this.onKey.bind(this),
      onFullscreen  : this.onFullscreen.bind(this),
      updateStyling : this.updateStyling.bind(this)
    };
  }
  
  init () {
    this.attachEventHandlers();
  }

  /**
   * Find the first visible video element on the page if one hasn't already been found.
   * @param {boolean} force  Whether to look for a video element, even if one already exists
   * @returns {boolean}      True if a new element was found, false if not.
   */
  findVideoElement (force = false) {
    // if (force === true || this.element == null ) {
      let element = findVisibleVideoElement();
      if (element) {
        this.setVideoElement(element);
        return true;
      } else {
        if (this.element != null) {
          // I'm not sure this is necessary when the element no longer exists, but let's be safe
          this.unsetVideoElement();
        }
      }
    // }
    return false;
  }

  setVideoElement (element) {
    // Compare the found element to the current we have
    // Note that we can't use isSameNode or isEqualNode since they compare the style
    if (element != null && (
      this.element == null || (
        element.parentNode      != this.element.parentNode ||
        element.previousSibling != this.element.previousSibling ||
        element.nextSibling     != this.element.nextSibling
      )
    )) {
      console.log("Found new video element:", element);
      this.unsetVideoElement();
      this.element = element;
      this.element.addEventListener('loadedmetadata', this.handlers.updateStyling);
    }
  }
  
  unsetVideoElement () {
    if (this.element) {
      this.element.removeEventListener('loadedmetadata', this.handlers.updateStyling);
      // Remove our styling from the element
      this.setStyling(null);
      this.element = null;
    }
  }

  attachEventHandlers () {
    window.addEventListener('load', this.handlers.init);
    document.addEventListener('keyup', this.handlers.onKey);

    window.addEventListener('resize', this.handlers.updateStyling);
    document.addEventListener('mozfullscreenchange', this.handlers.onFullscreen);
  }

  onKey (event) {
    switch (event.key) {
      case KEY_BORDER:
        this.cycleRatio();
        if (this.current_ratio === null) {
          // Reset styling
          this.removeStyling();
          showMiniNotification('Original', getViewSize());
        } else {
          // Set styling for the new ratio
          this.setStyling(this.current_ratio);
          showMiniNotification(this.current_ratio, getViewSize());
        }
        break;
    }
  }

  onFullscreen (event) {
    this.fullscreen = !this.fullscreen;
    // The Fullscreen API doesn't seem to be available to extensions :(
    // this.fullscreen = (
    //   (document.mozFullScreen && document.mozFullScreenElement && document.mozFullScreenElement.nodeName === 'VIDEO') ||
    //   (document.fullscreenElement && document.fullscreenElement.nodeName === 'VIDEO')
    // );
    requestAnimationFrame(this.handlers.updateStyling);
  }

  cycleRatio () {
    let current_index = RATIO_ORDER.indexOf(this.current_ratio);
    if (current_index + 1 < RATIO_ORDER.length) {
      this.current_ratio = RATIO_ORDER[current_index + 1];
    } else {
      this.current_ratio = RATIO_ORDER[0];
    }
  }

  updateStyling () {
    if (this.element) {
      this.setStyling(this.current_ratio);
    }
  }
  
  setStyle (css_properties, properties) {
    SITE_TWEAKS.apply(this.element, css_properties, properties);
    // setStyle('video', this.element, css_properties);
  }
  
  restoreStyle () {
    SITE_TWEAKS.remove(this.element);
  }

  removeStyling () {
    this.restoreStyle();
  }
  
  // Set the style for the given aspect ratio
  setStyling (ratio = '16:9') {
    this.findVideoElement();

    if (this.element) {
      // Get the available view size
      let view_size     = getViewSize();
      // Get the source video's size
      let source_width  = this.element.videoWidth;
      let source_height = this.element.videoHeight;
      // Calculate the correct size of the video for the current ratio, based on the video width
      let ratio_width   = source_width;
      let ratio_height  = source_width * RATIOS[ratio];
      // Calculate how much we should scale the source to fit to the available view size
      let scale_amount  = Math.min( view_size.width / ratio_width, view_size.height / ratio_height);
      // Get our final vidoe size
      let scaled_width  = source_width * scale_amount;
      let scaled_height = source_height * scale_amount;
      // And calculate how much to offset it in order for it to be centred
      let offset_x      = (view_size.width  - scaled_width)  / 2 || 0;
      let offset_y      = (view_size.height - scaled_height) / 2 || 0;
      
      this.setStyle({
        'width'     : `${scaled_width}px`,
        'height'    : `${scaled_height}px`,
        'transform' : `translate(${offset_x}px, ${offset_y}px)`
      }, Object.assign({},
        { width: scaled_width, height: scaled_height },
        { area_width: view_size.width, area_height: view_size.height, area_top: view_size.top, area_element: view_size.area_element },
        { offset_x, offset_y, ratio_width, ratio_height, ratio }
      ));
    }
  }
}

const videoElement = new VideoElement();
videoElement.init();