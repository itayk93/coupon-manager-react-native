require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CouponWidget'
  s.version        = package['version']
  s.summary        = 'Shared storage bridge between the app and the home-screen widget.'
  s.description    = 'Writes the widget payload into the App Group container and reloads WidgetKit timelines.'
  s.author         = ''
  s.homepage       = 'https://github.com/itayk93/coupon-master'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = { :type => 'MIT' }

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
