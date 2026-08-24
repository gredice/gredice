#!/usr/bin/env swift

import AppKit
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("error: \(message)\n".utf8))
    exit(1)
}

let arguments = CommandLine.arguments
guard arguments.count == 6 else {
    fail("usage: render-svg-png.swift <input.svg> <output.png> <width> <height> <rgb|rgba>")
}

let input = arguments[1]
let output = arguments[2]
guard let width = Int(arguments[3]), width > 0,
      let height = Int(arguments[4]), height > 0 else {
    fail("width and height must be positive integers")
}

let mode = arguments[5]
guard mode == "rgb" || mode == "rgba" else {
    fail("color mode must be rgb or rgba")
}

guard let image = NSImage(contentsOfFile: input) else {
    fail("unable to load \(input)")
}

let hasAlpha = mode == "rgba"
var proposedRect = NSRect(x: 0, y: 0, width: width, height: height)
guard let source = image.cgImage(
    forProposedRect: &proposedRect,
    context: nil,
    hints: [.interpolation: NSImageInterpolation.high]
) else {
    fail("unable to rasterize \(input)")
}

let alphaInfo: CGImageAlphaInfo = hasAlpha ? .premultipliedLast : .noneSkipLast
guard let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: alphaInfo.rawValue
) else {
    fail("unable to create bitmap context")
}

context.interpolationQuality = .high
context.setFillColor(hasAlpha
    ? CGColor(red: 0, green: 0, blue: 0, alpha: 0)
    : CGColor(red: 1, green: 1, blue: 1, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: width, height: height))
context.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))

guard let rendered = context.makeImage() else {
    fail("unable to finish bitmap")
}
let bitmap = NSBitmapImageRep(cgImage: rendered)
guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fail("unable to encode PNG")
}

do {
    try png.write(to: URL(fileURLWithPath: output), options: .atomic)
} catch {
    fail("unable to write \(output): \(error.localizedDescription)")
}
