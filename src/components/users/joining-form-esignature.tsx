"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SignaturePad } from './signature-pad';
import { toast } from 'sonner';
import { User } from '@/models/models';

interface JoiningFormESignatureProps {
  user: User;
  onComplete?: () => void;
}

export function JoiningFormESignature({ user, onComplete }: JoiningFormESignatureProps) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [agreement, setAgreement] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!signature) {
      toast.error('Please provide your signature');
      return;
    }

    if (!agreement) {
      toast.error('Please agree to the terms and conditions');
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

  const canSubmit = signature && agreement && !isSubmitting;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Employee Joining Form - E-Signature
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
                <p className="text-gray-700">{user.department}</p>
              </div>
              <div>
                <Label className="font-medium">Date of Joining:</Label>
                <p className="text-gray-700">
                  {user.doj ? new Date(user.doj).toLocaleDateString() : 'N/A'}
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
              <h3 className="text-lg font-semibold mb-4 text-orange-800">
                Terms and Conditions of Employment
              </h3>
              <div className="space-y-4 text-sm text-gray-700">
                <p className="font-medium">
                  By signing this joining form, I hereby confirm and agree to the following terms and conditions of employment:
                </p>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-orange-800">1. Employment Terms</h4>
                    <p>I will be employed on a probationary basis for an initial period of 6 months and based on the Company's view of my performance, I will be deemed confirmed. My employment will be for a period of five years effective from the date of joining and may be renewed on a review of performance.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-800">2. Compensation</h4>
                    <p>I will be eligible for the gross salary as specified in my appointment letter. Such compensation will be subject to tax deduction at source and other statutory deductions as applicable.</p>
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
                    <p>During my probationary period, my employment may be terminated by the Company upon 5 days prior written notice (or payment of five day's salary in lieu thereof). At all other times, my employment may be terminated by the company upon 30 days' notice or payment of 30 days salary in lieu thereof. I may terminate my employment upon 30 days' notice in writing; failing which my 30 days salary will be deducted as notice period.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-800">6. Confidentiality</h4>
                    <p>I shall observe utmost confidentiality and secrecy of any and all information received by me or entrusted to me in the course of my employment and I shall at all times, whether during or after the termination of my employment, act with utmost fidelity and not disclose or divulge such information to a third party or make use of such information for my own benefit.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-800">7. Company Policies</h4>
                    <p>I have read and understood the requirements of the Company's Business Conduct Policy and agree to act in compliance with such policy (including any modifications or amendments thereto) at all times. Any willful default of the policy will result in disciplinary action, which may include actions up to and including summary dismissal.</p>
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
                      <li>The company's phone should not be used for personal calls or activities.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-800">10. Information Accuracy</h4>
                    <p>I confirm that all the information provided in this joining form is true, accurate, and complete to the best of my knowledge. I understand that any false or misleading information may result in immediate termination of my employment.</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-orange-800">11. Digital Signature</h4>
                    <p>I understand that this digital signature has the same legal validity as a handwritten signature and constitutes my acceptance of all terms and conditions outlined in this agreement.</p>
                  </div>
                </div>

                <div className="bg-orange-100 p-4 rounded-lg border border-orange-300">
                  <p className="font-semibold text-orange-800 text-center">
                    I acknowledge that I have read, understood, and agree to all the terms and conditions stated above. I understand that my signature below constitutes acceptance of these terms and conditions of employment.
                  </p>
                </div>
              </div>
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
              onCheckedChange={(checked) => setAgreement(checked as boolean)}
            />
            <Label htmlFor="agreement" className="text-sm">
              I have read, understood, and agree to all the terms and conditions stated above
            </Label>
          </div>

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
              {isSubmitting ? 'Submitting...' : 'Sign and Submit Joining Form'}
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
        </CardContent>
      </Card>
    </div>
  );
} 