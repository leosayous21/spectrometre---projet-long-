/* Flot plugin for adding cursors to the plot.

 Copyright (c) cipix2000@gmail.com.
 Copyright (c) 2007-2014 IOLA and Ole Laursen.
 Licensed under the MIT license.
 */

/*global jQuery*/

(function ($) {
  'use strict';

  var options = {
    cursors: []
  };

  var constants = {
    iRectSize: 8,
    symbolSize: 8,
    mouseGrabMargin: 8,
    labelPadding: 10
  };

  function init(plot) {
    var cursors = [];
    var update = [];

    function createCursor(options) {
      return mixin(options, {
        name: options.name || ('unnamed ' + cursors.length),
        position: options.position || {
          relativeX: 10,
          relativeY: 20
        },
        x: 0,
        y: 0,
        selected: false,
        highlighted: false,
        mode: 'xy',
        showIntersections: false,
        showLabel: false,
        showValuesRelativeToSeries: undefined,
        color: 'gray',
        lineWidth: 1,
        movable: true,
        mouseButton: 'all',
        dashes: 1,
        intersectionColor: 'darkgray',
        fontSize: 10,
        intersectionLabelPosition: 'bottom-right',
      });
    }

    plot.hooks.processOptions.push(function (plot) {
      plot.getOptions().cursors.forEach(function (options) {
        plot.addCursor(options);
      });
    });

    plot.getCursors = function () {
      return cursors;
    };

    plot.addCursor = function addCursor(options) {
      var currentCursor = createCursor(options);

      setPosition(plot, currentCursor, options.position);
      cursors.push(currentCursor);

      plot.triggerRedrawOverlay();
    };

    plot.removeCursor = function removeCursor(cursor) {
      var index = cursors.indexOf(cursor);

      if (index !== -1) {
        cursors.splice(index, 1);
      }

      plot.triggerRedrawOverlay();
    };

    plot.setCursor = function setCursor(cursor, options) {
      var index = cursors.indexOf(cursor);

      if (index !== -1) {
        mixin(options, cursors[index]);
        setPosition(plot, cursors[index], cursors[index].position);
        plot.triggerRedrawOverlay();
      }
    };

    plot.getIntersections = function getIntersections(cursor) {
      var index = cursors.indexOf(cursor);

      if (index !== -1) {
        return cursors[index].intersections;
      }

      return [];
    };

    function onMouseOut(e) {
      onMouseUp(e);
    }

    var selectedCursor = function (cursors) {
      var result;

      cursors.forEach(function (cursor) {
        if (cursor.selected) {
          if (!result)
            result = cursor;
        }
      });

      return result;
    };

    var selectCursor = function (cursors, cursor) {
      cursors.forEach(function (c) {
        if (c === cursor) {
          c.selected = true;
        } else {
          c.selected = false;
        }
      });
    };

    // possible issues with ie8
    var correctMouseButton = function (cursor, buttonNumber) {
      switch (cursor.mouseButton) {
        case 'all':
          return true;
        case 'left':
          return buttonNumber === 0;
        case 'middle':
          return buttonNumber === 1;
        case 'right':
          return buttonNumber === 2;
        default:
          return true;
      }
    };

    function onMouseDown(e) {
      var offset = plot.offset();
      var mouseX = Math.max(0, Math.min(e.pageX - offset.left, plot.width()));
      var mouseY = Math.max(0, Math.min(e.pageY - offset.top, plot.height()));

      var currentlySelectedCursor = selectedCursor(cursors);

      if (currentlySelectedCursor) {
        // unselect the cursor and move it to the current position
        currentlySelectedCursor.selected = false;
        plot.getPlaceholder().css('cursor', 'default');
        currentlySelectedCursor.x = mouseX;
        currentlySelectedCursor.y = mouseY;
        plot.triggerRedrawOverlay();
      } else {
        // find nearby cursor and unlock it
        var targetCursor;
        var dragmode;

        cursors.forEach(function (cursor) {
          if (!cursor.movable) {
            return;
          }
          if (mouseOverCursorHorizontalLine(e, plot, cursor)) {
            targetCursor = cursor;
            dragmode = 'y';
          }
          if (mouseOverCursorVerticalLine(e, plot, cursor)) {
            targetCursor = cursor;
            dragmode = 'x';
          }
          if (mouseOverCursorManipulator(e, plot, cursor)) {
            targetCursor = cursor;
            dragmode = 'xy';
          }
        });

        if (targetCursor) {
          if (!correctMouseButton(targetCursor, e.button)) {
            return;
          }
          targetCursor.selected = true;
          targetCursor.dragmode = dragmode;
          // changed for InsightCM -max
          if (targetCursor.mode === 'x') {
            plot.getPlaceholder().css('cursor', 'ew-resize');
          } else if (targetCursor.mode === 'y') {
            plot.getPlaceholder().css('cursor', 'ns-resize');
          } else {
            plot.getPlaceholder().css('cursor', 'move');
          }
          plot.triggerRedrawOverlay();
        }
      }
    }

    function onMouseUp(e) {
      var offset = plot.offset();
      var mouseX = Math.max(0, Math.min(e.pageX - offset.left, plot.width()));
      var mouseY = Math.max(0, Math.min(e.pageY - offset.top, plot.height()));
      var currentlySelectedCursor = selectedCursor(cursors);

      if (currentlySelectedCursor) {
        if (!correctMouseButton(currentlySelectedCursor, e.button)) {
          return;
        }
        // lock the free cursor to current position
        currentlySelectedCursor.selected = false;
        if (currentlySelectedCursor.dragmode.indexOf('x') !== -1) {
          currentlySelectedCursor.x = mouseX;
        }
        if (currentlySelectedCursor.dragmode.indexOf('y') !== -1) {
          currentlySelectedCursor.y = mouseY;
        }
        plot.getPlaceholder().css('cursor', 'default');
        plot.triggerRedrawOverlay();
      }
    }

    function onMouseMove(e) {
      var offset = plot.offset();
      var mouseX = Math.max(0, Math.min(e.pageX - offset.left, plot.width()));
      var mouseY = Math.max(0, Math.min(e.pageY - offset.top, plot.height()));

      var currentlySelectedCursor = selectedCursor(cursors);

      if (currentlySelectedCursor) {
        if (currentlySelectedCursor.dragmode.indexOf('x') !== -1) {
          currentlySelectedCursor.position.relativeX = Math.max(0, Math.min(e.pageX - offset.left, plot.width()));
          currentlySelectedCursor.x = currentlySelectedCursor.position.relativeX;
        }
        if (currentlySelectedCursor.dragmode.indexOf('y') !== -1) {
          currentlySelectedCursor.position.relativeY = Math.max(0, Math.min(e.pageY - offset.top, plot.height()));
          currentlySelectedCursor.y = currentlySelectedCursor.position.relativeY;
        }

        plot.triggerRedrawOverlay();
      } else {
        cursors.forEach(function (cursor) {
          if (!cursor.movable) {
            return;
          }
          if (mouseOverCursorManipulator(e, plot, cursor)) {
            if (!cursor.highlighted) {
              cursor.highlighted = true;
              plot.triggerRedrawOverlay();
            }
            plot.getPlaceholder().css('cursor', 'pointer');
          } else if (mouseOverCursorVerticalLine(e, plot, cursor)) {
            if (!cursor.highlighted) {
              cursor.highlighted = true;
              plot.triggerRedrawOverlay();
            }
            plot.getPlaceholder().css('cursor', 'col-resize');
          } else if (mouseOverCursorHorizontalLine(e, plot, cursor)) {
            if (!cursor.highlighted) {
              cursor.highlighted = true;
              plot.triggerRedrawOverlay();
            }
            plot.getPlaceholder().css('cursor', 'row-resize');
          } else {
            if (cursor.highlighted) {
              cursor.highlighted = false;
              plot.getPlaceholder().css('cursor', 'default');
              plot.triggerRedrawOverlay();
            }
          }
        });
      }
    }

    plot.hooks.bindEvents.push(function (plot, eventHolder) {
      eventHolder.mousedown(onMouseDown);
      eventHolder.mouseup(onMouseUp);
      eventHolder.mouseout(onMouseOut);
      eventHolder.mousemove(onMouseMove);
    });

    function findIntersections(plot, cursor) {
      var pos = plot.c2p({
        left: cursor.x,
        top: cursor.y
      });

      var intersections = {
        cursor: cursor.name,
        x: pos.x,
        y: pos.y,
        points: []
      };

      var axes = plot.getAxes();
      if (pos.x < axes.xaxis.min || pos.x > axes.xaxis.max ||
        pos.y < axes.yaxis.min || pos.y > axes.yaxis.max) {
        return;
      }

      var i, j, dataset = plot.getData();

      for (i = 0; i < dataset.length; ++i) {
        var series = dataset[i];

        // Find the nearest points, x-wise
        for (j = 0; j < series.data.length; ++j) {
          if (series.data[j] && series.data[j][0] > pos.x) {
            break;
          }
        }

        // Now Interpolate
        var y,
          p1 = series.data[j - 1],
          p2 = series.data[j];

        if ((p1 === undefined) && (p2 === undefined)) {
          continue;
        }

        if (p1 === undefined || p1 === null) {
          y = p2[1];
        } else if (p2 === undefined || p2 === null) {
          y = p1[1];
        } else {
          y = p1[1] + (p2[1] - p1[1]) * (pos.x - p1[0]) / (p2[0] - p1[0]);
        }
        pos.y = y;
        pos.y1 = y;

        intersections.points.push({
          x: pos.x,
          y: pos.y
        });
      }

      return intersections;
    }

    plot.hooks.drawOverlay.push(function (plot, ctx) {
      var i = 0;
      update = [];
      var intersections;

      cursors.forEach(function (cursor) {
        var plotOffset = plot.getPlotOffset();

        ctx.save();
        ctx.translate(plotOffset.left, plotOffset.top);

        setPosition(plot, cursor, cursor.position, intersections);
        intersections = findIntersections(plot, cursor);
        maybeSnapToPlot(plot, cursor, intersections);

        if (cursor.x !== -1) {
          drawVerticalAndHorizontalLines(plot, ctx, cursor);

          cursor.intersections = intersections;
          update.push(intersections);

          drawLabel(plot, ctx, cursor);
          drawIntersections(plot, ctx, cursor);
          drawValues(plot, ctx, cursor);
          if (cursor.symbol !== 'none') {
            drawManipulator(plot, ctx, cursor);
          }
        }
        ctx.restore();
        i++;
      });

      plot.getPlaceholder().trigger('cursorupdates', [update]);
    });

    plot.hooks.shutdown.push(function (plot, eventHolder) {
      eventHolder.unbind("mousedown", onMouseDown);
      eventHolder.unbind("mouseup", onMouseUp);
      eventHolder.unbind("mouseout", onMouseOut);
      eventHolder.unbind("mousemove", onMouseMove);
      eventHolder.unbind("cursorupdates");
      plot.getPlaceholder().css('cursor', 'default');
    });
  }

  function mixin(source, destination) {
    Object.keys(source).forEach(function (key) {
      destination[key] = source[key];
    });

    return destination;
  }

  function setPosition(plot, cursor, pos) {
    var o;
    if (!pos)
      return;

    o = plot.p2c(pos);

    if ((pos.relativeX !== undefined)) {
      cursor.x = Math.max(0, Math.min(pos.relativeX, plot.width()));
      if (pos.relativeY === undefined) {
        cursor.y = Math.max(0, Math.min(o.top, plot.height()));
      } else {
        cursor.y = Math.max(0, Math.min(pos.relativeY, plot.height()));
      }
    } else if (pos.relativeY !== undefined) {
      cursor.x = Math.max(0, Math.min(o.left, plot.width()));
      cursor.y = Math.max(0, Math.min(pos.relativeY, plot.height()));
    } else {
      cursor.x = Math.max(0, Math.min(o.left, plot.width()));
      cursor.y = Math.max(0, Math.min(o.top, plot.height()));
    }
  }

  function maybeSnapToPlot(plot, cursor, intersections) {
    if (cursor.snapToPlot !== undefined) {
      var point = intersections.points[cursor.snapToPlot];
      if (point) {
        setPosition(plot, cursor, {
          x: point.x,
          y: point.y
        });

        intersections.y = point.y; // update cursor position
      }
    }
  }

  function computeLabelPosition(plot, cursor, offset) {
    var width = plot.width();
    var height = plot.height();
    var textAlign = 'left';

    var y = cursor.y;
    var x = cursor.x;

    if (x > (width / 2)) {
      x -= constants.labelPadding;
      textAlign = 'right';
    } else {
      x += constants.labelPadding;
    }

    if (y > (height / 2)) {
      y -= constants.labelPadding + offset;
    } else {
      y += constants.labelPadding + cursor.fontSize;
    }

    return {
      x: x,
      y: y,
      textAlign: textAlign
    };
  }

  function drawLabel(plot, ctx, cursor) {
    if (cursor.showLabel) {
      ctx.beginPath();
      var position = computeLabelPosition(plot, cursor,
        typeof cursor.showValuesRelativeToSeries === 'number' ? constants.labelPadding * 2 : 0);
      ctx.fillStyle = cursor.color;
      ctx.textAlign = position.textAlign;
      ctx.fillText(cursor.name, position.x, position.y);
      ctx.textAlign = 'left';
      ctx.stroke();
    }
  }

  function drawIntersections(plot, ctx, cursor) {
    if (cursor.showIntersections && hasVerticalLine(cursor)) {
      ctx.beginPath();
      if (cursor.intersections === undefined) {
        return;
      }
      cursor.intersections.points.forEach(function (point, index) {
        if (typeof cursor.showIntersections === 'object') {
          if (cursor.showIntersections.indexOf(index) === -1) {
            return;
          }
        }
        var coord = plot.p2c(point);
        ctx.fillStyle = cursor.intersectionColor;
        ctx.fillRect(Math.floor(coord.left) - constants.iRectSize / 2,
          Math.floor(coord.top) - constants.iRectSize / 2,
          constants.iRectSize, constants.iRectSize);
        var text = "";
        var x;
        var y;
        ctx.font = cursor.fontSize + 'px sans-serif';
        switch (cursor.intersectionLabelPosition) {
          case 'bottom-left':
            var textWidth = ctx.measureText(text).width;
            x = coord.left - textWidth - constants.iRectSize;
            y = coord.top + cursor.fontSize;
            break;
          case 'top-left':
            var textWidth = ctx.measureText(text).width;
            x = coord.left - textWidth - constants.iRectSize;
            y = coord.top - constants.iRectSize;
            break;
          case 'top-right':
            x = coord.left + constants.iRectSize;
            y = coord.top - constants.iRectSize;
            break;
          case 'bottom-right':
          default:
            x = coord.left + constants.iRectSize;
            y = coord.top + cursor.fontSize;
            break;
        }

        ctx.fillText(text, x, y);
      });
      ctx.stroke();
    }
  }

  function drawValues(plot, ctx, cursor) {
    if (typeof cursor.showValuesRelativeToSeries === 'number') {
      ctx.beginPath();
      var dataset = plot.getData();

      var series = dataset[cursor.showValuesRelativeToSeries];
      var xaxis = series.xaxis;
      var yaxis = series.yaxis;

      var text = '' + xaxis.c2p(cursor.x).toFixed(2) + ', ' + yaxis.c2p(cursor.y).toFixed(2);

      var position = computeLabelPosition(plot, cursor, cursor.showLabel ? constants.labelPadding * 2 : 0);

      ctx.fillStyle = cursor.color;
      ctx.textAlign = position.textAlign;
      ctx.font = cursor.fontSize + 'px sans-serif';
      ctx.fillText(text, position.x, position.y + (cursor.showLabel ? constants.labelPadding * 2 : 0));

      ctx.textAlign = 'left';

      ctx.stroke();
    }
  }

  function drawVerticalAndHorizontalLines(plot, ctx, cursor) {
    // abort draw if linewidth is zero
    if (cursor.lineWidth === 0) {
      return;
    }
    // keep line sharp
    var adj = cursor.lineWidth % 2 ? 0.5 : 0;

    ctx.strokeStyle = cursor.color;
    ctx.lineWidth = cursor.lineWidth;
    ctx.lineJoin = "round";

    ctx.beginPath();

    if (cursor.mode.indexOf("x") !== -1) {
      var drawX = Math.floor(cursor.x) + adj;
      if (cursor.dashes <= 0) {
        ctx.moveTo(drawX, 0);
        ctx.lineTo(drawX, plot.height());
      } else {
        var numberOfSegments = cursor.dashes * 2 - 1;
        var delta = plot.height() / numberOfSegments;
        for (var i = 0; i < numberOfSegments; i += 2) {
          ctx.moveTo(drawX, delta * i);
          ctx.lineTo(drawX, delta * (i + 1));
        }
      }
    }
    if (cursor.mode.indexOf("y") !== -1) {
      var drawY = Math.floor(cursor.y) + adj;
      if (cursor.dashes <= 0) {
        ctx.moveTo(0, drawY);
        ctx.lineTo(plot.width(), drawY);
      } else {
        var numberOfSegments = cursor.dashes * 2 - 1;
        var delta = plot.width() / numberOfSegments;
        for (var i = 0; i < numberOfSegments; i += 2) {
          ctx.moveTo(delta * i, drawY);
          ctx.lineTo(delta * (i + 1), drawY);
        }
      }
    }

    ctx.stroke();
  }

  function drawManipulator(plot, ctx, cursor) {
    // keep line sharp
    var adj = cursor.lineWidth % 2 ? 0.5 : 0;
    ctx.beginPath();

    if (cursor.highlighted)
      ctx.strokeStyle = 'orange';
    else
      ctx.strokeStyle = cursor.color;
    if (cursor.symbol && plot.drawSymbol && plot.drawSymbol[cursor.symbol]) {
      //first draw a white background
      ctx.fillStyle = 'white';
      ctx.fillRect(Math.floor(cursor.x) + adj - (constants.symbolSize / 2 + 1),
        Math.floor(cursor.y) + adj - (constants.symbolSize / 2 + 1),
        constants.symbolSize + 2, constants.symbolSize + 2);
      plot.drawSymbol[cursor.symbol](ctx, Math.floor(cursor.x) + adj,
        Math.floor(cursor.y) + adj, constants.symbolSize / 2, 0);
    } else {
      ctx.fillRect(Math.floor(cursor.x) + adj - (constants.symbolSize / 2),
        Math.floor(cursor.y) + adj - (constants.symbolSize / 2),
        constants.symbolSize, constants.symbolSize);
    }

    ctx.stroke();
  }

  function hasVerticalLine(cursor) {
    return (cursor.mode.indexOf('x') !== -1);
  }

  function hasHorizontalLine(cursor) {
    return (cursor.mode.indexOf('y') !== -1);
  }

  function mouseOverCursorManipulator(e, plot, cursor) {
    var offset = plot.offset();
    var mouseX = Math.max(0, Math.min(e.pageX - offset.left, plot.width()));
    var mouseY = Math.max(0, Math.min(e.pageY - offset.top, plot.height()));
    var grabRadius = constants.symbolSize + constants.mouseGrabMargin;

    return ((mouseX > cursor.x - grabRadius) && (mouseX < cursor.x + grabRadius) &&
        (mouseY > cursor.y - grabRadius) && (mouseY < cursor.y + grabRadius)) &&
      (cursor.symbol !== 'none');
  }

  function mouseOverCursorVerticalLine(e, plot, cursor) {
    var offset = plot.offset();
    var mouseX = Math.max(0, Math.min(e.pageX - offset.left, plot.width()));
    var mouseY = Math.max(0, Math.min(e.pageY - offset.top, plot.height()));

    return (hasVerticalLine(cursor) && (mouseX > cursor.x - constants.mouseGrabMargin) &&
      (mouseX < cursor.x + constants.mouseGrabMargin) && (mouseY > 0) && (mouseY < plot.height()));
  }

  function mouseOverCursorHorizontalLine(e, plot, cursor) {
    var offset = plot.offset();
    var mouseX = Math.max(0, Math.min(e.pageX - offset.left, plot.width()));
    var mouseY = Math.max(0, Math.min(e.pageY - offset.top, plot.height()));

    return (hasHorizontalLine(cursor) && (mouseY > cursor.y - constants.mouseGrabMargin) &&
      (mouseY < cursor.y + constants.mouseGrabMargin) && (mouseX > 0) && (mouseY < plot.width()));
  }

  $.plot.plugins.push({
    init: init,
    options: options,
    name: 'cursors',
    version: '0.1'
  });
})(jQuery);
