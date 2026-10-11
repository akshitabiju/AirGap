/** Strings for the My Air section in English and Hindi.
 *  Guidance is adapted from CPCB's National AQI health advisories (general guidance, not medical advice). */
export type Lang = 'en' | 'hi'
export type Profile = 'general' | 'sensitive' | 'child' | 'active'
export type BandKey = 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very poor' | 'Severe' | 'No data'

type Advice = { level: 0 | 1 | 2 | 3; title: string; text: string }

interface Strings {
  band: Record<BandKey, string>
  ui: Record<string, string>
  profiles: Record<Profile, { label: string; hint: string }>
  advice: (band: BandKey, profile: Profile) => Advice
}

const en: Strings = {
  band: { Good: 'Good', Satisfactory: 'Satisfactory', Moderate: 'Moderate', Poor: 'Poor', 'Very poor': 'Very poor', Severe: 'Severe', 'No data': 'No data' },
  ui: {
    eyebrow: 'Your air', heading_a: 'What should ', heading_you: 'you', heading_b: ' do today?',
    intro: 'Tell us where you are and who you are. We keep this on your device only; nothing is sent anywhere.',
    locate: 'Use my location', search: 'Find your town or city…', who: 'Who is this for?',
    geo_error: "Couldn't get your location (permission denied or unavailable). Search for your town instead.",
    geo_outside: 'You seem to be outside India; the model only covers Indian districts. Search a town to explore.',
    empty: "Pick a location to see today's estimate, what it means for you, and the district on the map.",
    detected: 'detected', nearest: 'nearest monitor', km_away: 'km away', unmonitored: 'this is a model estimate for an unmonitored district', monitored: 'close to a monitor',
    vs_who: 'vs WHO guideline', cigs: 'cigarettes / day', vs_yesterday: 'vs yesterday', next3: 'Next three days (forecast)',
    worse: 'getting worse', better: 'improving', same: 'about the same', today: 'Today',
    disclaimer: 'General guidance adapted from CPCB AQI health advisories. Not medical advice.', show_map: 'Show on the map',
    lang: 'हिंदी',
  },
  profiles: {
    general: { label: 'Healthy adult', hint: 'No known respiratory or heart condition' },
    sensitive: { label: 'Asthma / heart / 60+', hint: 'Respiratory or cardiac condition, pregnancy, or older adult' },
    child: { label: 'Child at home', hint: 'Children breathe faster and are more affected' },
    active: { label: 'Outdoor work / sport', hint: 'Heavy breathing outdoors multiplies the dose' },
  },
  advice: (b, profile) => {
    const sens = profile !== 'general'
    switch (b) {
      case 'Good': return { level: 0, title: 'Clear to go outside', text: 'Air is within India’s safe band. Open the windows, exercise outdoors.' }
      case 'Satisfactory': return sens
        ? { level: 1, title: 'Fine, with a small caveat', text: 'Most people are unaffected. If you notice breathing discomfort, shorten intense outdoor activity.' }
        : { level: 0, title: 'Fine for you', text: 'Minor effects possible only for very sensitive people. No change needed.' }
      case 'Moderate': return sens
        ? { level: 2, title: 'Limit heavy exertion outdoors', text: profile === 'child' ? 'Keep playtime calm and shorter; watch for coughing or wheezing.' : 'Avoid long runs or heavy work outside; keep a reliever inhaler at hand if prescribed.' }
        : { level: 1, title: 'Ease off hard workouts outside', text: 'Light activity is fine. Prolonged, intense exertion may cause discomfort.' }
      case 'Poor': return sens
        ? { level: 3, title: 'Stay in, or mask up', text: 'Avoid outdoor exertion. If you must go out, wear a well-fitted N95. Keep windows closed in the hours of worst air.' }
        : { level: 2, title: 'Cut outdoor exertion', text: 'Reduce prolonged outdoor activity; an N95 helps for commutes. Close windows during peaks.' }
      case 'Very poor': return { level: 3, title: 'Avoid outdoor exposure', text: sens ? 'Stay indoors, run a purifier if you have one, and seek care if breathing worsens.' : 'Avoid outdoor exertion, wear an N95 outside, keep windows closed, use a purifier if available.' }
      default: return { level: 3, title: 'Stay indoors', text: 'Health emergency band. Avoid going out; seal rooms; use a purifier; seek care for any breathing difficulty.' }
    }
  },
}

const hi: Strings = {
  band: { Good: 'अच्छी', Satisfactory: 'संतोषजनक', Moderate: 'मध्यम', Poor: 'खराब', 'Very poor': 'बहुत खराब', Severe: 'गंभीर', 'No data': 'डेटा नहीं' },
  ui: {
    eyebrow: 'आपकी हवा', heading_a: 'आज ', heading_you: 'आपको', heading_b: ' क्या करना चाहिए?',
    intro: 'बताइए आप कहाँ हैं और कौन हैं। यह जानकारी सिर्फ़ आपके डिवाइस पर रहती है; कहीं नहीं भेजी जाती।',
    locate: 'मेरी लोकेशन इस्तेमाल करें', search: 'अपना शहर या कस्बा खोजें…', who: 'यह किसके लिए है?',
    geo_error: 'आपकी लोकेशन नहीं मिल सकी (अनुमति नहीं या उपलब्ध नहीं)। अपना शहर खोजें।',
    geo_outside: 'लगता है आप भारत से बाहर हैं; यह मॉडल सिर्फ़ भारतीय ज़िलों के लिए है। कोई शहर खोजें।',
    empty: 'आज का अनुमान, आपके लिए उसका मतलब, और नक्शे पर ज़िला देखने के लिए कोई जगह चुनें।',
    detected: 'पता लगाया गया', nearest: 'निकटतम मॉनिटर', km_away: 'किमी दूर', unmonitored: 'बिना मॉनिटर वाले ज़िले के लिए मॉडल का अनुमान', monitored: 'मॉनिटर के पास',
    vs_who: 'WHO मानक के मुकाबले', cigs: 'सिगरेट / दिन', vs_yesterday: 'कल के मुकाबले', next3: 'अगले तीन दिन (पूर्वानुमान)',
    worse: 'बिगड़ रही है', better: 'सुधर रही है', same: 'लगभग वैसी ही', today: 'आज',
    disclaimer: 'CPCB की AQI स्वास्थ्य सलाह पर आधारित सामान्य मार्गदर्शन। यह चिकित्सीय सलाह नहीं है।', show_map: 'नक्शे पर दिखाएँ',
    lang: 'English',
  },
  profiles: {
    general: { label: 'स्वस्थ वयस्क', hint: 'साँस या हृदय की कोई ज्ञात बीमारी नहीं' },
    sensitive: { label: 'अस्थमा / हृदय / 60+', hint: 'साँस या हृदय रोग, गर्भावस्था, या बुज़ुर्ग' },
    child: { label: 'घर में बच्चा', hint: 'बच्चे तेज़ साँस लेते हैं और ज़्यादा प्रभावित होते हैं' },
    active: { label: 'बाहर काम / खेल', hint: 'बाहर तेज़ साँस लेने से असर कई गुना बढ़ता है' },
  },
  advice: (b, profile) => {
    const sens = profile !== 'general'
    switch (b) {
      case 'Good': return { level: 0, title: 'बाहर जाने के लिए ठीक है', text: 'हवा भारत के सुरक्षित दायरे में है। खिड़कियाँ खोलें, बाहर व्यायाम करें।' }
      case 'Satisfactory': return sens
        ? { level: 1, title: 'ठीक है, थोड़ी सावधानी के साथ', text: 'अधिकतर लोगों पर असर नहीं। साँस लेने में परेशानी हो तो बाहर की तेज़ गतिविधि कम करें।' }
        : { level: 0, title: 'आपके लिए ठीक है', text: 'केवल बहुत संवेदनशील लोगों पर मामूली असर संभव। कुछ बदलने की ज़रूरत नहीं।' }
      case 'Moderate': return sens
        ? { level: 2, title: 'बाहर भारी मेहनत सीमित करें', text: profile === 'child' ? 'खेल का समय शांत और छोटा रखें; खाँसी या साँस में सीटी पर नज़र रखें।' : 'बाहर लंबी दौड़ या भारी काम से बचें; डॉक्टर का बताया इनहेलर पास रखें।' }
        : { level: 1, title: 'बाहर कड़ी कसरत कम करें', text: 'हल्की गतिविधि ठीक है। लंबी, तेज़ मेहनत से असुविधा हो सकती है।' }
      case 'Poor': return sens
        ? { level: 3, title: 'घर में रहें, या मास्क पहनें', text: 'बाहर मेहनत से बचें। बाहर जाना ज़रूरी हो तो अच्छी तरह फिट N95 पहनें। सबसे खराब हवा के समय खिड़कियाँ बंद रखें।' }
        : { level: 2, title: 'बाहर की मेहनत कम करें', text: 'बाहर लंबी गतिविधि कम करें; आने-जाने में N95 मदद करता है। प्रदूषण चरम पर हो तो खिड़कियाँ बंद रखें।' }
      case 'Very poor': return { level: 3, title: 'बाहर की हवा से बचें', text: sens ? 'घर के अंदर रहें, प्यूरीफायर हो तो चलाएँ, साँस बिगड़े तो डॉक्टर से मिलें।' : 'बाहर मेहनत से बचें, बाहर N95 पहनें, खिड़कियाँ बंद रखें, प्यूरीफायर हो तो इस्तेमाल करें।' }
      default: return { level: 3, title: 'घर के अंदर रहें', text: 'स्वास्थ्य आपातकाल स्तर। बाहर न जाएँ; कमरे बंद रखें; प्यूरीफायर चलाएँ; साँस में कोई भी तकलीफ़ हो तो तुरंत इलाज लें।' }
    }
  },
}

export const STRINGS: Record<Lang, Strings> = { en, hi }
