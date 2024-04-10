const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define the User model
const userSchema = new mongoose.Schema({
  phoneNumber: String,
  firstName: String,
  surname: String,
  dateOfBirth: String,
  medicalAidProvider: String,
  medicalAidNumber: String,
  scheme: String,
  dependantNumber: String,
});

const User = mongoose.model('User', userSchema);

// WhatsApp Cloud API configuration
const whatsappCloudApiConfig = {
  fromPhoneNumberId: process.env.WHATSAPP_CLOUD_API_FROM_PHONE_NUMBER_ID,
  accessToken: process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN,
};

// Send a text message using WhatsApp Cloud API
async function sendTextMessage(to, message) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v13.0/${whatsappCloudApiConfig.fromPhoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whatsappCloudApiConfig.accessToken}`,
        },
      }
    );
    console.log('Message sent successfully');
  } catch (error) {
    console.error('Error sending message:', error.response.data);
  }
}

// Send a button message using WhatsApp Cloud API
async function sendButtonMessage(to, message, buttons) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v13.0/${whatsappCloudApiConfig.fromPhoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: message,
          },
          action: {
            buttons: buttons.map((button) => ({
              type: 'reply',
              reply: {
                id: button.id,
                title: button.title,
              },
            })),
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${whatsappCloudApiConfig.accessToken}`,
        },
      }
    );
    console.log('Button message sent successfully');
  } catch (error) {
    console.error('Error sending button message:', error.response.data);
  }
}

// Download media using WhatsApp Cloud API
async function downloadMedia(mediaId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v13.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${whatsappCloudApiConfig.accessToken}`,
        },
        responseType: 'stream',
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error downloading media:', error.response.data);
    return null;
  }
}

// Handle incoming messages
app.post('/webhook', async (req, res) => {
  const notifications = req.body.entry[0].changes[0].value.messages;

  for (const notification of notifications) {
    const from = notification.from;
    const message = notification.text ? notification.text.body : '';

    // Check user registration
    const user = await User.findOne({ phoneNumber: from });

    if (!user) {
      // User not registered, start registration process
      if (message === 'Hi') {
        await sendTextMessage(
          from,
          "Hi! Thank you for contacting Telepharma Botswana. Let's start the registration process."
        );
        const buttons = [
          { id: 'first_name', title: 'Provide First Name' },
        ];
        await sendButtonMessage(
          from,
          'Please select the button below to provide your first name.',
          buttons
        );
      } else if (message === 'first_name') {
        await sendTextMessage(from, 'Please provide your first name.');
      } else if (/^[a-zA-Z]+$/.test(message)) {
        const firstName = message;
        const buttons = [
          { id: 'surname', title: 'Provide Surname' },
        ];
        await sendButtonMessage(
          from,
          'Please select the button below to provide your surname.',
          buttons
        );
      } else if (message === 'surname') {
        await sendTextMessage(from, 'Please provide your surname.');
      } else if (/^[a-zA-Z]+$/.test(message)) {
        const surname = message;
        const buttons = [
          { id: 'date_of_birth', title: 'Provide Date of Birth' },
        ];
        await sendButtonMessage(
          from,
          'Please select the button below to provide your date of birth.',
          buttons
        );
      } else if (message === 'date_of_birth') {
        await sendTextMessage(
          from,
          'Please provide your date of birth in the format DD/MM/YYYY.'
        );
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(message)) {
        const dateOfBirth = message;
        const buttons = [
          { id: 'BOMAID', title: 'BOMAID' },
          { id: 'PULA', title: 'PULA' },
          { id: 'BPOMAS', title: 'BPOMAS' },
          { id: 'BOTSOGO', title: 'BOTSOGO' },
        ];
        await sendButtonMessage(
          from,
          'Please select your medical aid provider from the options below:',
          buttons
        );
      } else if (['BOMAID', 'PULA', 'BPOMAS', 'BOTSOGO'].includes(message)) {
        const medicalAidProvider = message;
        const buttons = [
          { id: 'medical_aid_number', title: 'Provide Medical Aid Number' },
        ];
        await sendButtonMessage(
          from,
          'Please select the button below to provide your medical aid number.',
          buttons
        );
      } else if (message === 'medical_aid_number') {
        await sendTextMessage(from, 'Please provide your medical aid number.');
      } else if (/^\d+$/.test(message)) {
        const medicalAidNumber = message;
        const buttons = [
          { id: 'scheme', title: 'Provide Scheme' },
          { id: 'no_scheme', title: 'No Scheme' },
        ];
        await sendButtonMessage(
          from,
          'Please select the button below to provide your scheme (if applicable).',
          buttons
        );
      } else if (message === 'scheme') {
        await sendTextMessage(from, 'Please provide your scheme.');
      } else if (message === 'no_scheme') {
        const scheme = 'N/A';
        const buttons = [
          { id: 'dependant_number', title: 'Provide Dependant Number' },
          { id: 'no_dependant', title: 'No Dependant' },
        ];
        await sendButtonMessage(
          from,
          'Please select the button below to provide your dependant number (if applicable).',
          buttons
        );
      } else if (/^[a-zA-Z0-9]+$/.test(message)) {
        const scheme = message;
        const buttons = [
          { id: 'dependant_number', title: 'Provide Dependant Number' },
          { id: 'no_dependant', title: 'No Dependant' },
        ];
        await sendButtonMessage(
          from,
          'Please select the button below to provide your dependant number (if applicable).',
          buttons
        );
      } else if (message === 'dependant_number') {
        await sendTextMessage(from, 'Please provide your dependant number.');
      } else if (message === 'no_dependant') {
        const dependantNumber = 'N/A';
        // Save user details to the database
        const newUser = new User({
          phoneNumber: from,
          firstName,
          surname,
          dateOfBirth,
          medicalAidProvider,
          medicalAidNumber,
          scheme,
          dependantNumber,
        });
        await newUser.save();
        const buttons = [
          { id: 'medication_delivery', title: 'Medication Delivery' },
          { id: 'pharmacy_consultation', title: 'Pharmacy Consultation' },
          { id: 'doctor_consultation', title: 'Doctor Consultation' },
          { id: 'general_enquiry', title: 'General Enquiry' },
        ];
        await sendButtonMessage(
          from,
          'Thank you for registering! Now, please select from the services below:',
          buttons
        );
      } else if (/^\d+$/.test(message)) {
        const dependantNumber = message;
        // Save user details to the database
        const newUser = new User({
          phoneNumber: from,
          firstName,
          surname,
          dateOfBirth,
          medicalAidProvider,
          medicalAidNumber,
          scheme,
          dependantNumber,
        });
        await newUser.save();
        const buttons = [
          { id: 'medication_delivery', title: 'Medication Delivery' },
          { id: 'pharmacy_consultation', title: 'Pharmacy Consultation' },
          { id: 'doctor_consultation', title: 'Doctor Consultation' },
          { id: 'general_enquiry', title: 'General Enquiry' },
        ];
        await sendButtonMessage(
          from,
          'Thank you for registering! Now, please select from the services below:',
          buttons
        );
      }
    } else {
      // User already registered, handle service selection
      if (message === 'medication_delivery') {
        const buttons = [
          { id: 'prescription_medicine', title: 'Prescription Medicine' },
          { id: 'over_the_counter_medicine', title: 'Over-the-Counter Medicine' },
        ];
        await sendButtonMessage(
          from,
          'Great! Please select the type of medication you need:',
          buttons
        );
      } else if (message === 'prescription_medicine') {
        await sendTextMessage(
          from,
          'Please upload a photo of your prescription or type it out.'
        );
      } else if (notification.image) {
        // Download the prescription image
        const imageId = notification.image.id;
        const response = await downloadMedia(imageId);
        const imagePath = `prescriptions/${imageId}.jpg`;
        const imageStream = response.pipe(require('fs').createWriteStream(imagePath));
        await new Promise((resolve) => imageStream.on('finish', resolve));
        await sendTextMessage(
          from,
          "Thank you for providing your prescription. We'll process your request, and a pharmacist will review it. Your medication will be delivered soon."
        );
        const buttons = [
          { id: 'request_other_services', title: 'Request Other Services' },
          { id: 'speak_to_pharmacist', title: 'Speak to a Pharmacist' },
        ];
        await sendButtonMessage(
          from,
          'If you have any more questions or need assistance in the future, feel free to reach out.',
          buttons
        );
      } else if (message === 'over_the_counter_medicine') {
        await sendTextMessage(
          from,
          'Please provide the name or description of the over-the-counter medicine you need.'
        );
      } else if (['pharmacy_consultation', 'doctor_consultation', 'general_enquiry'].includes(message)) {
        await sendTextMessage(
          from,
          'Please provide more details about your request, and a pharmacist will assist you shortly.'
        );
      } else if (message === 'request_other_services') {
        const buttons = [
          { id: 'medication_delivery', title: 'Medication Delivery' },
          { id: 'pharmacy_consultation', title: 'Pharmacy Consultation' },
          { id: 'doctor_consultation', title: 'Doctor Consultation' },
          { id: 'general_enquiry', title: 'General Enquiry' },
        ];
        await sendButtonMessage(
          from,
          'Please select from the services below:',
          buttons
        );
      } else if (message === 'speak_to_pharmacist') {
        await sendTextMessage(
          from,
          'A pharmacist will be available to assist you shortly. Please provide any additional details or instructions you may have.'
        );
      }
    }
  }

  res.sendStatus(200);
});

// Handle webhooks
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});