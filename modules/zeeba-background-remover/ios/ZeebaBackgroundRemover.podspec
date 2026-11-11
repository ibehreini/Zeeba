Pod::Spec.new do |s|
  s.name           = 'ZeebaBackgroundRemover'
  s.version        = '1.0.0'
  s.summary        = 'On-device background removal for Zeeba clothing photos'
  s.description    = 'Cuts the garment out of a photo with the Vision framework subject-lifting API (iOS 17+).'
  s.license        = 'UNLICENSED'
  s.author         = 'Zeeba'
  s.homepage       = 'https://github.com/ibehreini/Zeeba'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/ibehreini/Zeeba.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
