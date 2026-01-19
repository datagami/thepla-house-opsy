"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SignaturePad } from './signature-pad';
import { WebcamCapture } from './webcam-capture';
import { toast } from 'sonner';
import { User } from '@/models/models';
import { Camera } from 'lucide-react';
import { formatDateOnly } from '@/lib/utils';

interface JoiningFormESignatureProps {
  user: User;
  onComplete?: () => void;
}

export function JoiningFormESignature({ user, onComplete }: JoiningFormESignatureProps) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [agreement, setAgreement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoTaken, setPhotoTaken] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  const handlePhotoCapture = (photoData: string) => {
    setPhotoTaken(photoData);
    setShowCamera(false);
  };

  const handleAgreementChange = (checked: boolean) => {
    setAgreement(checked);
    if (checked && !photoTaken) {
      setShowCamera(true);
    }
  };

  const handleSubmit = async () => {
    if (!signature) {
      toast.error('Please provide your signature');
      return;
    }

    if (!agreement) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    if (!photoTaken) {
      toast.error('Please take a photo to confirm your identity');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/users/${user.id}/joining-form-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          agreement: true,
          photo: photoTaken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit signature');
      }

      toast.success('Joining form signed successfully!');
      
      if (onComplete) {
        onComplete();
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error submitting signature:', error);
      toast.error('Failed to submit signature. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = signature && agreement && photoTaken && !isSubmitting;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Employee Appointment Letter - E-Signature
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Employee Information Summary */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Employee Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="font-medium">Name:</Label>
                <p className="text-gray-700">{user.name}</p>
              </div>
              <div>
                <Label className="font-medium">Employee ID:</Label>
                <p className="text-gray-700">{user.numId}</p>
              </div>
              <div>
                <Label className="font-medium">Email:</Label>
                <p className="text-gray-700">{user.email}</p>
              </div>
              <div>
                <Label className="font-medium">Department:</Label>
                <p className="text-gray-700">{user.department?.name || 'N/A'}</p>
              </div>
              <div>
                <Label className="font-medium">Date of Joining:</Label>
                <p className="text-gray-700">
                  {user.doj ? formatDateOnly(user.doj) : 'N/A'}
                </p>
              </div>
              <div>
                <Label className="font-medium">Role:</Label>
                <p className="text-gray-700">{user.role}</p>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-orange-800">
                  {lang === 'en' ? 'Terms and Conditions of Employment' : 'रोज़गार की शर्तें और नियम'}
                </h3>
                <div className="inline-flex rounded-md overflow-hidden border border-orange-300">
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`px-3 py-1 text-sm ${lang === 'en' ? 'bg-orange-600 text-white' : 'bg-white text-orange-700'}`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('hi')}
                    className={`px-3 py-1 text-sm ${lang === 'hi' ? 'bg-orange-600 text-white' : 'bg-white text-orange-700'}`}
                  >
                    हिन्दी
                  </button>
                </div>
              </div>

              {lang === 'en' && (
                <div className="space-y-4 text-sm text-gray-700">
                  <p className="font-medium">
                    By signing this appointment letter, I hereby confirm and agree to the following terms and conditions of employment:
                  </p>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-orange-800">1. Employment Terms</h4>
                      <p>I will be employed on a probationary basis for an initial period of 6 months and based on the Company&#39;s view of my performance, I will be deemed confirmed. My employment will be for a period of five years effective from the date of joining and may be renewed on a review of performance.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">2. Compensation</h4>
                      <p>I will be eligible for a gross salary of Rs. {user.salary?.toLocaleString() || 'N/A'} per month from the company. Such compensation received by me will be subject to tax deduction at source, as applicable under the provisions of the Income-Tax Act, 1961 (&ldquo;IT Act&rdquo;) and the Rules made thereunder and such other statutory deductions, as applicable.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">3. Hours of Work</h4>
                      <p>My hours of work will be determined by the company in accordance with the needs of its business and company policy. The company reserves the right to alter work hours and/or workdays including the time(s) I start and/or conclude work on given day(s).</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">4. Exclusive Services</h4>
                      <p>During the continuance of my employment with the Company, I shall devote the whole of my time, attention and abilities to the business and affairs of the Company. I shall not, at any time, during the period of my employment, directly or indirectly, be employed, engaged, concerned or interested in any other employment whatsoever.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">5. Termination</h4>
                      <p>During my probationary period, my employment may be terminated by the Company with immediate effect, without any notice or salary in lieu thereof. After completion of probation, my employment may be terminated by the Company upon 30 days’ prior written notice or payment of 30 days’ salary in lieu thereof. I may terminate my employment at any time by giving 30 days’ written notice; failing which, an amount equal to 30 days’ salary will be deducted as notice period recovery.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">6. Confidentiality</h4>
                      <p>I shall observe utmost confidentiality and secrecy of any and all information received by me or entrusted to me in the course of my employment and I shall at all times, whether during or after the termination of my employment, act with utmost fidelity and not disclose or divulge such information to a third party or make use of such information for my own benefit.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">7. Company Policies</h4>
                      <p>I have read and understood the requirements of the Company&#39;s Business Conduct Policy and agree to act in compliance with such policy (including any modifications or amendments thereto) at all times. Any willful default of the policy will result in disciplinary action, which may include actions up to and including summary dismissal.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">8. Return of Company Property</h4>
                      <p>Not later than 10 days following the date of termination of my employment, I shall deliver to the company all equipment, property, materials, data and other information furnished to me by or on behalf of the company, including keys, passes etc.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">9. Working Rules and Regulations</h4>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>I must work for 30 days to receive salary. If I leave before 30 days, I am not eligible to receive salary.</li>
                        <li>Salary payments will not be made in cash. The Bank account should be in my name.</li>
                        <li>I will be eligible for 1 paid leave if I work for 15 days or more in a month, and 2 paid leaves if I work for 25 days or more.</li>
                        <li>I must report my monthly off before 8 PM the previous day.</li>
                        <li>Duty hours are 12 hours: 7 AM to 7 PM or 11 AM to 11 PM.</li>
                        <li>Any misconduct involving company property will result in cost of damages being deducted from my salary.</li>
                        <li>No non-vegetarian food, alcoholic beverages, or tobacco use is allowed on company premises during working hours.</li>
                        <li>I must maintain personal hygiene, including short and trimmed hair and nails.</li>
                        <li>No jewelry is allowed during working hours.</li>
                        <li>I must wear the provided uniform, including safety shoes, caps, and aprons.</li>
                        <li>Personal mobile phones are not allowed during order processing.</li>
                        <li>The company&#39;s phone should not be used for personal calls or activities.</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">10. Information Accuracy</h4>
                      <p>I confirm that all the information provided in this appointment letter is true, accurate, and complete to the best of my knowledge. I understand that any false or misleading information may result in immediate termination of my employment.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">11. Digital Signature</h4>
                      <p>I understand that this digital signature has the same legal validity as a handwritten signature and constitutes my acceptance of all terms and conditions outlined in this agreement.</p>
                    </div>
                  </div>
                  <div className="bg-orange-100 p-4 rounded-lg border border-orange-300 mt-4">
                    <p className="font-semibold text-orange-800 text-center">
                      I acknowledge that I have read, understood, and agree to all the terms and conditions stated above. I understand that my signature below constitutes acceptance of these terms and conditions of employment.
                    </p>
                  </div>
                </div>
              )}

              {lang === 'hi' && (
                <div className="space-y-4 text-sm text-gray-700">
                  <p className="font-medium">
                    इस नियुक्ति पत्र पर हस्ताक्षर करके, मैं निम्नलिखित रोजगार की शर्तों और नियमों को पढ़कर सहमत होता/होती हूँ:
                  </p>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-orange-800">1. नियुक्ति की शर्तें</h4>
                      <p>मैं 6 महीनों की परिवीक्षा अवधि पर नियुक्त किया/की जाऊँगा/गी और मेरे प्रदर्शन के आधार पर मुझे पुष्टि माना जाएगा। मेरी नियुक्ति ज्वॉइनिंग की तारीख से पाँच वर्षों के लिए होगी और प्रदर्शन समीक्षा के आधार पर नवीनीकृत की जा सकती है।</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">2. वेतन</h4>
                      <p>मुझे कंपनी से प्रति माह रु. {user.salary?.toLocaleString() || 'N/A'} का सकल वेतन मिलेगा। यह वेतन आयकर अधिनियम, 1961 तथा लागू नियमों के अनुसार स्रोत पर कर कटौती और अन्य वैधानिक कटौतियों के अधीन होगा।</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">3. कार्य के घंटे</h4>
                      <p>मेरे कार्य के घंटे कंपनी की व्यावसायिक आवश्यकता और नीतियों के अनुसार होंगे। कंपनी कार्य के घंटे/दिनों में परिवर्तन कर सकती है।</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">4. विशिष्ट सेवाएँ</h4>
                      <p>रोज़गार की अवधि के दौरान, मैं अपना संपूर्ण समय, ध्यान और क्षमता कंपनी के कार्यों को समर्पित करूँगा/गी और किसी अन्य रोजगार/व्यवसाय में संलग्न नहीं रहूँगा/गी।</p>
                    </div>
                    <div>
                       <h4 className="font-semibold text-orange-800">5. त्यागपत्र/समाप्ति</h4>
                       <p>परिवीक्षा अवधि के दौरान कंपनी मेरा रोजगार तत्काल प्रभाव से, बिना किसी नोटिस या वेतन के बदले भुगतान के समाप्त कर सकती है। परिवीक्षा पूर्ण होने के बाद, कंपनी 30 दिन के पूर्व लिखित नोटिस या 30 दिन के वेतन के बदले भुगतान पर मेरा रोजगार समाप्त कर सकती है। मैं किसी भी समय 30 दिन का लिखित नोटिस देकर अपना रोजगार समाप्त कर सकता/सकती हूँ; अन्यथा, नोटिस अवधि वसूली के रूप में 30 दिन के वेतन के बराबर राशि काट ली जाएगी।</p>
                     </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">6. गोपनीयता</h4>
                      <p>रोज़गार के दौरान प्राप्त किसी भी प्रकार की गोपनीय जानकारी का मैं कड़ाई से पालन करूँगा/गी और बिना अनुमति किसी तीसरे पक्ष के साथ साझा नहीं करूँगा/गी।</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">7. कंपनी नीतियाँ</h4>
                      <p>मैं कंपनी की आचार नीति को पढ़कर उससे सहमत हूँ और सदैव उसका पालन करूँगा/गी। उल्लंघन की स्थिति में अनुशासनात्मक कार्यवाही (आवश्यक होने पर तत्काल बर्खास्तगी सहित) की जा सकती है।</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">8. कंपनी संपत्ति की वापसी</h4>
                      <p>रोज़गार समाप्ति के 10 दिनों के भीतर मैं कंपनी की सभी संपत्ति/सामग्री/डेटा/चाबियाँ/पास आदि को सुव्यवस्थित अवस्था में वापस कर दूँगा/गी।</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">9. कार्य नियम एवं विनियम</h4>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>वेतन के लिए कम-से-कम 30 दिन कार्य आवश्यक है; उससे पहले छोड़ने पर वेतन देय नहीं होगा।</li>
                        <li>वेतन नकद में नहीं मिलेगा; बैंक खाता मेरे नाम पर होना चाहिए।</li>
                        <li>महीने में 15+ दिन काम पर 1, और 25+ दिन काम पर 2 भुगतान अवकाश मिलेंगे।</li>
                        <li>मंथ-ऑफ की सूचना पिछले दिन रात 8 बजे तक देनी होगी।</li>
                        <li>ड्यूटी घंटे 12 हैं: 7AM–7PM या 11AM–11PM।</li>
                        <li>कंपनी संपत्ति को नुकसान होने पर लागत वेतन से समायोजित की जा सकती है।</li>
                        <li>कार्य समय में नॉन-वेज/मद्य/तम्बाकू का उपयोग वर्जित है।</li>
                        <li>निजी स्वच्छता (बाल/नाखून) बनाए रखना आवश्यक है।</li>
                        <li>आभूषण पहनना अनुमत नहीं है।</li>
                        <li>यूनिफॉर्म, सेफ्टी शूज़, कैप, एप्रन पहनना अनिवार्य है।</li>
                        <li>ऑर्डर के समय निजी मोबाइल फोन का उपयोग निषिद्ध है।</li>
                        <li>कंपनी के फोन का निजी कार्य के लिए उपयोग न करें।</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">10. जानकारी की सटीकता</h4>
                      <p>मैं पुष्टि करता/करती हूँ कि इस नियुक्ति पत्र में दी गई जानकारी मेरे ज्ञान के अनुसार सही है। कोई भी गलत/भ्रामक जानकारी पाए जाने पर रोजगार तत्काल समाप्त किया जा सकता है।</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-orange-800">11. डिजिटल हस्ताक्षर</h4>
                      <p>मैं समझता/समझती हूँ कि यह डिजिटल हस्ताक्षर कानूनी रूप से हस्तलिखित हस्ताक्षर के समान है और इससे इस समझौते की सभी शर्तों की मेरी स्वीकृति मानी जाएगी।</p>
                    </div>
                  </div>
                  <div className="bg-orange-100 p-4 rounded-lg border border-orange-300 mt-4">
                    <p className="font-semibold text-orange-800 text-center">
                      मैं उपरोक्त सभी शर्तों और नियमों को पढ़कर समझ चुका/चुकी हूँ और उनसे सहमत हूँ। नीचे किया गया मेरा हस्ताक्षर इन शर्तों की स्वीकृति दर्शाता है।
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scroll Indicator */}
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-4 py-2 rounded-full">
              <span>↓</span>
              <span>Please scroll down to continue</span>
              <span>↓</span>
            </div>
          </div>

          {/* Agreement Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="agreement"
              checked={agreement}
              onCheckedChange={handleAgreementChange}
            />
            <Label htmlFor="agreement" className="text-sm">
              I have read, understood, and agree to all the terms and conditions stated above
            </Label>
          </div>

          {/* Photo Capture Section */}
          {agreement && !showCamera && !photoTaken && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-blue-800 flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Identity Verification Photo
                </h3>
                <div className="text-center space-y-4">
                  <p className="text-sm text-gray-700">
                    Please take a photo to confirm your identity and complete the signing process.
                  </p>
                  <Button onClick={() => setShowCamera(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Webcam Component */}
          {showCamera && (
            <WebcamCapture
              onPhotoCapture={handlePhotoCapture}
              onClose={() => setShowCamera(false)}
            />
          )}

          {/* Photo Display */}
          {photoTaken && !showCamera && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-green-800 flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Photo Captured
                </h3>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <img
                        src={photoTaken}
                        alt="Captured photo"
                        className="w-full max-w-md mx-auto border-2 border-green-300 rounded-lg shadow-lg"
                      />
                      <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                        <span className="text-xs">✓</span>
                      </div>
                    </div>
                    <p className="text-sm text-green-600 mt-2 font-medium">
                      ✓ Identity verification photo captured successfully
                    </p>
                  </div>
                  <div className="text-center">
                    <Button 
                      onClick={() => {
                        setPhotoTaken(null);
                        setShowCamera(true);
                      }} 
                      variant="outline"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Retake Photo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Signature Pad */}
          <SignaturePad
            onSignatureChange={setSignature}
            disabled={isSubmitting}
          />

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              size="lg"
              className="px-8"
            >
              {isSubmitting ? 'Submitting...' : 'Sign and Submit Appointment Letter'}
            </Button>
          </div>

          {/* Status Messages */}
          {!agreement && (
            <div className="text-center text-sm text-red-600">
              Please agree to the terms and conditions to proceed
            </div>
          )}
          {!signature && agreement && (
            <div className="text-center text-sm text-red-600">
              Please provide your signature to proceed
            </div>
          )}
          {!photoTaken && agreement && signature && (
            <div className="text-center text-sm text-red-600">
              Please take a photo to confirm your identity
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 
