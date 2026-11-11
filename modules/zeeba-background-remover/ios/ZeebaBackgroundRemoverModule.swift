import CoreImage
import ExpoModulesCore
import Vision

/// Longest side, in pixels, of the image handed to Vision. A 12 MP iPhone
/// photo would otherwise produce a ~48 MB RGBA buffer for a cutout that the
/// upload step downsizes anyway.
private let maxWorkingDimension: CGFloat = 2048

/**
 Cuts the main subject (the garment) out of a photo, on device.

 Uses `VNGenerateForegroundInstanceMaskRequest` - the same subject-lifting
 model as "lift subject" in Photos - which is class-agnostic, so it works on
 clothing laid flat. (The person-segmentation request that most background
 removal packages wrap finds nothing in a photo with no person in it.)

 JS wrapper: src/utils/removeBackground.native.ts
 */
public final class ZeebaBackgroundRemoverModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ZeebaBackgroundRemover")

    // Subject lifting shipped in iOS 17; the JS side hides the button below that.
    Function("isAvailable") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    // AsyncFunction bodies run off the main thread, so the Vision request
    // (roughly a second on recent phones) never blocks the UI.
    AsyncFunction("removeBackground") { (uri: String) -> [String: Any] in
      guard #available(iOS 17.0, *) else {
        throw UnsupportedOSException()
      }
      return try Self.removeBackground(from: uri)
    }
  }

  /// Loads the image at `uri` (a local `file://` photo or a remote `https://`
  /// one), masks out everything but the foreground subject, crops to it, and
  /// writes a transparent PNG to the temporary directory.
  @available(iOS 17.0, *)
  private static func removeBackground(from uri: String) throws -> [String: Any] {
    guard let url = URL(string: uri) else {
      throw UnreadableImageException(uri)
    }

    let data: Data
    do {
      data = try Data(contentsOf: url)
    } catch {
      throw UnreadableImageException(uri)
    }
    // applyOrientationProperty bakes the EXIF rotation in, so a portrait
    // iPhone photo is upright here and the cutout comes out upright too.
    guard let original = CIImage(data: data, options: [.applyOrientationProperty: true]) else {
      throw UnreadableImageException(uri)
    }

    let longestSide = max(original.extent.width, original.extent.height)
    guard longestSide > 0 else {
      throw UnreadableImageException(uri)
    }
    // Uniform scale (same factor on both axes) - the garment is never stretched.
    let scale = min(1, maxWorkingDimension / longestSide)
    let scaled = original.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    let working = scaled.transformed(
      by: CGAffineTransform(translationX: -scaled.extent.origin.x, y: -scaled.extent.origin.y)
    )

    let context = CIContext()
    guard let workingImage = context.createCGImage(working, from: working.extent) else {
      throw ProcessingFailedException()
    }

    let handler = VNImageRequestHandler(cgImage: workingImage, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    do {
      try handler.perform([request])
    } catch {
      let exception = ProcessingFailedException()
      exception.cause = error
      throw exception
    }

    guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
      throw NoSubjectFoundException()
    }

    // All instances, not just the largest: a belt or tie lying next to the
    // garment is segmented as its own instance and belongs in the cutout.
    let maskedBuffer: CVPixelBuffer
    do {
      maskedBuffer = try observation.generateMaskedImage(
        ofInstances: observation.allInstances,
        from: handler,
        croppedToInstancesExtent: true
      )
    } catch {
      let exception = ProcessingFailedException()
      exception.cause = error
      throw exception
    }

    let cutout = CIImage(cvPixelBuffer: maskedBuffer)
    guard
      let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
      let png = context.pngRepresentation(of: cutout, format: .RGBA8, colorSpace: colorSpace, options: [:])
    else {
      throw ProcessingFailedException()
    }

    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("zeeba-cutouts", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let fileURL = directory.appendingPathComponent("\(UUID().uuidString).png")
    try png.write(to: fileURL, options: .atomic)

    return [
      "uri": fileURL.absoluteString,
      "width": Int(cutout.extent.width),
      "height": Int(cutout.extent.height)
    ]
  }
}

// The JS wrapper maps these by `code` (derived from the class name, e.g.
// ERR_NO_SUBJECT_FOUND) to user-facing messages.

internal final class UnsupportedOSException: Exception {
  override var reason: String {
    "Background removal needs iOS 17 or later"
  }
}

internal final class UnreadableImageException: GenericException<String> {
  override var reason: String {
    "Could not read the image at \(param.prefix(80))"
  }
}

internal final class NoSubjectFoundException: Exception {
  override var reason: String {
    "No clear subject was found in the photo"
  }
}

internal final class ProcessingFailedException: Exception {
  override var reason: String {
    "Background removal failed"
  }
}
