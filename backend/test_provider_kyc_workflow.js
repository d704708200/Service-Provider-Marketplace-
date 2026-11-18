const dotenv = require('dotenv');
dotenv.config();

const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Provider = require('./src/models/Provider');
const { generateToken } = require('./src/utils/jwt');
const providerService = require('./src/services/providerService');
const cloudinary = require('./src/config/cloudinary');
const app = require('./src/app');

const uniqueId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
let server;
let baseUrl;
let providerUser;
let adminUser;
let provider;
const deletedAssets = [];
const originalUploadImage = cloudinary.uploadImage;
const originalDeleteAsset = cloudinary.deleteAsset;

cloudinary.uploadImage = async (_file, options) => ({
  url: `https://storage.test/${options.public_id}`,
  public_id: options.public_id,
  storage: 'test'
});
cloudinary.deleteAsset = async (publicId) => {
  deletedAssets.push(publicId);
};

const request = (method, path, token, body) =>
  new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(url, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

const requestMultipart = (path, token, docType, contents = 'mock KYC image') =>
  new Promise((resolve, reject) => {
    const boundary = `----KYCWorkflowBoundary${Date.now()}`;
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="docType"\r\n\r\n${docType}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${docType}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      Buffer.from(contents),
      `\r\n--${boundary}--\r\n`
    ];
    const payload = Buffer.concat(parts.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(part)));
    const url = new URL(baseUrl + path);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length
      }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });

const documentSet = (prefix) => ({
  aadhaarFrontImage: `https://example.test/${prefix}-aadhaar-front.jpg`,
  aadhaarBackImage: `https://example.test/${prefix}-aadhaar-back.jpg`,
  panFrontImage: `https://example.test/${prefix}-pan-front.jpg`,
  panBackImage: `https://example.test/${prefix}-pan-back.jpg`
});

async function setup() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to run provider KYC workflow tests');
  }
  await mongoose.connect(process.env.MONGODB_URI);

  providerUser = await User.create({
    name: `KYC Provider ${uniqueId}`,
    email: `kyc-provider-${uniqueId}@example.com`,
    phone: `94${String(Date.now()).slice(-8)}`,
    password: 'Password123',
    role: 'provider'
  });
  adminUser = await User.create({
    name: `KYC Admin ${uniqueId}`,
    email: `kyc-admin-${uniqueId}@example.com`,
    phone: `95${String(Date.now()).slice(-8)}`,
    password: 'Password123',
    role: 'admin'
  });
  provider = await Provider.create({
    user: providerUser._id,
    businessName: 'KYC Workflow Provider',
    acceptedTermsVersion: '2026-11-17',
    acceptedTermsAt: new Date(),
    serviceCertification: {
      documentUrl: 'https://storage.test/independently-verified-certificate.pdf',
      verificationStatus: 'VERIFIED'
    }
  });
  assert.strictEqual(provider.kycStatus, 'NOT_SUBMITTED');

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}/api`;
      resolve();
    });
  });
}

async function teardown() {
  cloudinary.uploadImage = originalUploadImage;
  cloudinary.deleteAsset = originalDeleteAsset;
  if (provider) await Provider.deleteOne({ _id: provider._id });
  const userIds = [providerUser?._id, adminUser?._id].filter(Boolean);
  if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
}

async function run() {
  try {
    await setup();
    const providerToken = generateToken({
      userId: providerUser._id,
      email: providerUser.email,
      role: 'provider'
    });
    const adminToken = generateToken({
      userId: adminUser._id,
      email: adminUser.email,
      role: 'admin'
    });

    const newProviderProfile = await request('GET', '/providers/me', providerToken);
    assert.strictEqual(newProviderProfile.body.data.kycStatus, 'NOT_SUBMITTED');

    const incompleteSubmission = await request(
      'POST',
      '/providers/me/kyc/submit',
      providerToken,
      {}
    );
    assert.strictEqual(incompleteSubmission.status, 400);

    const documentTypes = {
      aadhaarFrontImage: 'aadhaar_front',
      aadhaarBackImage: 'aadhaar_back',
      panFrontImage: 'pan_front',
      panBackImage: 'pan_back'
    };
    for (const docType of Object.values(documentTypes)) {
      const upload = await requestMultipart(
        '/providers/me/kyc/upload',
        providerToken,
        docType
      );
      assert.strictEqual(upload.status, 200, JSON.stringify(upload.body));
    }

    const replacementUpload = await requestMultipart(
      '/providers/me/kyc/upload',
      providerToken,
      'aadhaar_front',
      'replacement image'
    );
    assert.strictEqual(replacementUpload.status, 200, JSON.stringify(replacementUpload.body));
    assert.ok(deletedAssets.length === 1, 'Replacing a draft document should remove its previous stored asset');

    const uploadedProvider = await Provider.findById(provider._id);
    const draftDocuments = Object.fromEntries(
      Object.entries(documentTypes).map(([field]) => [field, uploadedProvider[field]])
    );
    assert.strictEqual(draftDocuments.aadhaarFrontImage, replacementUpload.body.data.documentUrl);
    assert.ok(uploadedProvider.aadhaarFrontImagePublicId);

    const unuploadedUrls = await request(
      'POST',
      '/providers/me/kyc/submit',
      providerToken,
      documentSet('unuploaded')
    );
    assert.strictEqual(unuploadedUrls.status, 400);

    const submitted = await request(
      'POST',
      '/providers/me/kyc/submit',
      providerToken,
      draftDocuments
    );
    assert.strictEqual(submitted.status, 200);
    assert.strictEqual(submitted.body.data.kycStatus, 'PENDING');
    assert.ok(submitted.body.data.kycSubmittedAt);

    const duplicateSubmission = await request(
      'POST',
      '/providers/me/kyc/submit',
      providerToken,
      draftDocuments
    );
    assert.strictEqual(duplicateSubmission.status, 409);

    const providerReviewAttempt = await request(
      'PATCH',
      `/providers/admin/${provider._id}/kyc/review`,
      providerToken,
      { status: 'approved' }
    );
    assert.strictEqual(providerReviewAttempt.status, 403);

    const lockedDelete = await request(
      'DELETE',
      '/providers/me/kyc/pan_back',
      providerToken
    );
    assert.strictEqual(lockedDelete.status, 409, JSON.stringify(lockedDelete.body));
    const lockedUpload = await requestMultipart(
      '/providers/me/kyc/upload',
      providerToken,
      'pan_back',
      'must not upload'
    );
    assert.strictEqual(lockedUpload.status, 409, JSON.stringify(lockedUpload.body));
    const lockedLegacyUpload = await request(
      'POST',
      '/providers/me/documents',
      providerToken,
      {
        type: 'aadhaar_front',
        documentUrl: 'https://storage.test/unapproved-legacy-upload.jpg'
      }
    );
    assert.strictEqual(lockedLegacyUpload.status, 409);
    // Service certification is decoupled from KYC and can be managed independently
    const pendingProvider = await Provider.findById(provider._id);
    const aadhaarFrontDocument = pendingProvider.documents.find(
      (document) => document.type === 'aadhaar_front'
    );
    const unauthorizedDocumentReview = await request(
      'PATCH',
      `/providers/admin/${provider._id}/documents/${aadhaarFrontDocument._id}/status`,
      providerToken,
      { status: 'approved' }
    );
    assert.strictEqual(unauthorizedDocumentReview.status, 403);

    const prematureApproval = await request(
      'PATCH',
      `/providers/admin/${provider._id}/kyc/review`,
      adminToken,
      { status: 'approved' }
    );
    assert.strictEqual(prematureApproval.status, 409);
    assert.ok(
      prematureApproval.body.error.message.includes('Aadhaar Front must be approved before final KYC approval.') ||
      prematureApproval.body.error.message.includes('Aadhaar Front is still pending individual approval.')
    );

    const originalAadhaarFront = pendingProvider.aadhaarFrontImage;
    await Provider.updateOne({ _id: provider._id }, { $set: { aadhaarFrontImage: null } });
    const missingDocumentApproval = await request(
      'PATCH',
      `/providers/admin/${provider._id}/kyc/review`,
      adminToken,
      { status: 'approved' }
    );
    assert.strictEqual(missingDocumentApproval.status, 409);
    assert.ok(missingDocumentApproval.body.error.message.includes('Aadhaar Front is missing.'));
    await Provider.updateOne(
      { _id: provider._id },
      { $set: { aadhaarFrontImage: originalAadhaarFront } }
    );

    const generalApproval = await request(
      'PATCH',
      `/providers/admin/${provider._id}/verification`,
      adminToken,
      { status: 'verified' }
    );
    assert.strictEqual(generalApproval.status, 200);
    assert.strictEqual(generalApproval.body.data.verificationStatus, 'verified');
    assert.strictEqual(generalApproval.body.data.kycStatus, 'PENDING');
    assert.strictEqual(String(generalApproval.body.data.verificationReviewedBy._id), String(adminUser._id));
    assert.strictEqual(
      generalApproval.body.data.documents.find((document) => document.type === 'aadhaar_front').verificationStatus,
      'pending',
      'General provider verification must not approve a mandatory KYC document'
    );
    const profileAfterGeneralApproval = await request(
      'GET',
      '/providers/me',
      providerToken
    );
    assert.strictEqual(profileAfterGeneralApproval.body.data.verificationStatus, 'verified');
    assert.strictEqual(profileAfterGeneralApproval.body.data.kycStatus, 'PENDING');
    const queueAfterGeneralApproval = await request(
      'GET',
      '/providers/admin/pending',
      adminToken
    );
    assert.ok(
      queueAfterGeneralApproval.body.data.some((item) => String(item._id) === String(provider._id)),
      'General verification must not hide a pending KYC application from the admin queue'
    );

    for (const type of ['aadhaar_front', 'aadhaar_back', 'pan_front']) {
      const currentProvider = await Provider.findById(provider._id);
      const document = currentProvider.documents.find((item) => item.type === type);
      const documentApproval = await request(
        'PATCH',
        `/providers/admin/${provider._id}/documents/${document._id}/status`,
        adminToken,
        { status: 'approved', reviewNote: 'Mandatory KYC identity document verified' }
      );
      assert.strictEqual(documentApproval.status, 200, JSON.stringify(documentApproval.body));
      const reviewedDocument = documentApproval.body.data.documents.find((item) => item.type === type);
      assert.strictEqual(reviewedDocument.verificationStatus, 'approved');
      assert.strictEqual(String(reviewedDocument.reviewedBy._id), String(adminUser._id));
      assert.ok(reviewedDocument.reviewedAt);
    }

    const rejection = await request(
      'PATCH',
      `/providers/admin/${provider._id}/kyc/review`,
      adminToken,
      {
        status: 'rejected',
        rejectionReason: 'PAN back image is unclear',
        rejectedDocuments: ['pan_back']
      }
    );
    assert.strictEqual(rejection.status, 200);
    assert.strictEqual(rejection.body.data.kycStatus, 'REJECTED');
    assert.strictEqual(rejection.body.data.kycRejectionReason, 'PAN back image is unclear');
    assert.strictEqual(String(rejection.body.data.kycReviewedBy._id), String(adminUser._id));
    assert.strictEqual(rejection.body.data.verificationStatus, 'verified');
    assert.strictEqual(rejection.body.data.serviceCertification.verificationStatus, 'VERIFIED');
    assert.ok(rejection.body.data.kycReviewedAt);
    const rejectedDocumentStatuses = Object.fromEntries(
      rejection.body.data.documents
        .filter((document) => Object.values(documentTypes).includes(document.type))
        .map((document) => [document.type, document.verificationStatus])
    );
    assert.strictEqual(rejectedDocumentStatuses.pan_back, 'rejected');
    assert.strictEqual(rejectedDocumentStatuses.aadhaar_front, 'approved');
    assert.strictEqual(rejectedDocumentStatuses.aadhaar_back, 'approved');
    assert.strictEqual(rejectedDocumentStatuses.pan_front, 'approved');

    const rejectedDelete = await request(
      'DELETE',
      '/providers/me/kyc/pan_back',
      providerToken
    );
    assert.strictEqual(rejectedDelete.status, 409);

    const rejectedAcceptedUpload = await requestMultipart(
      '/providers/me/kyc/upload',
      providerToken,
      'aadhaar_front',
      'must not replace accepted document'
    );
    assert.strictEqual(rejectedAcceptedUpload.status, 409);

    const uncorrectedResubmission = await request(
      'POST',
      '/providers/me/kyc/submit',
      providerToken,
      draftDocuments
    );
    assert.strictEqual(uncorrectedResubmission.status, 400);

    const correctionUpload = await requestMultipart(
      '/providers/me/kyc/upload',
      providerToken,
      'pan_back',
      'corrected PAN back'
    );
    assert.strictEqual(correctionUpload.status, 200, JSON.stringify(correctionUpload.body));
    assert.ok(correctionUpload.body.data.uploadedAt);
    const correctedProvider = await Provider.findById(provider._id);
    const correctedDocuments = Object.fromEntries(
      Object.entries(documentTypes).map(([field]) => [field, correctedProvider[field]])
    );
    const resubmission = await request(
      'POST',
      '/providers/me/kyc/submit',
      providerToken,
      correctedDocuments
    );
    assert.strictEqual(resubmission.status, 200);
    assert.strictEqual(resubmission.body.data.kycStatus, 'PENDING');
    assert.strictEqual(resubmission.body.data.verificationStatus, 'verified');
    const resubmittedDocumentStatuses = Object.fromEntries(
      resubmission.body.data.documents
        .filter((document) => Object.values(documentTypes).includes(document.type))
        .map((document) => [document.type, document.verificationStatus])
    );
    assert.strictEqual(resubmittedDocumentStatuses.pan_back, 'pending');
    assert.strictEqual(resubmittedDocumentStatuses.aadhaar_front, 'approved');
    assert.strictEqual(resubmittedDocumentStatuses.aadhaar_back, 'approved');
    assert.strictEqual(resubmittedDocumentStatuses.pan_front, 'approved');

    const pendingPanBack = resubmission.body.data.documents.find(
      (document) => document.type === 'pan_back'
    );
    const pendingPanBackApproval = await request(
      'PATCH',
      `/providers/admin/${provider._id}/kyc/review`,
      adminToken,
      { status: 'approved' }
    );
    assert.strictEqual(pendingPanBackApproval.status, 409);
    assert.ok(
      pendingPanBackApproval.body.error.message.includes('PAN Back must be approved before final KYC approval.') ||
      pendingPanBackApproval.body.error.message.includes('PAN Back is still pending individual approval.')
    );

    await Provider.updateOne(
      { _id: provider._id, 'documents._id': pendingPanBack._id },
      { $set: { 'documents.$.verificationStatus': 'rejected' } }
    );
    const rejectedDocumentApproval = await request(
      'PATCH',
      `/providers/admin/${provider._id}/kyc/review`,
      adminToken,
      { status: 'approved' }
    );
    assert.strictEqual(rejectedDocumentApproval.status, 409);
    assert.ok(rejectedDocumentApproval.body.error.message.includes('PAN Back was rejected.'));
    await Provider.updateOne(
      { _id: provider._id, 'documents._id': pendingPanBack._id },
      { $set: { 'documents.$.verificationStatus': 'pending' } }
    );

    const approveCorrectedPanBack = await request(
      'PATCH',
      `/providers/admin/${provider._id}/documents/${pendingPanBack._id}/status`,
      adminToken,
      { status: 'approved', reviewNote: 'Corrected PAN back verified' }
    );
    assert.strictEqual(approveCorrectedPanBack.status, 200);
    const panBackReview = approveCorrectedPanBack.body.data.documents.find(
      (document) => document.type === 'pan_back'
    );
    assert.strictEqual(panBackReview.verificationStatus, 'approved');
    assert.strictEqual(String(panBackReview.reviewedBy._id), String(adminUser._id));
    const documentAuditBeforeKycApproval = Object.fromEntries(
      approveCorrectedPanBack.body.data.documents
        .filter((document) => Object.values(documentTypes).includes(document.type))
        .map((document) => [
          document.type,
          `${new Date(document.reviewedAt).toISOString()}:${document.reviewedBy?._id || document.reviewedBy}`
        ])
    );

    const pendingQueue = await request('GET', '/providers/admin/pending', adminToken);
    assert.strictEqual(pendingQueue.status, 200);
    assert.ok(
      pendingQueue.body.data.some((item) => String(item._id) === String(provider._id)),
      'Submitted KYC application should appear in the admin queue'
    );

    const generalRejection = await request(
      'PATCH',
      `/providers/admin/${provider._id}/verification`,
      adminToken,
      { status: 'rejected', rejectionReason: 'General provider profile requires correction' }
    );
    assert.strictEqual(generalRejection.status, 200);
    assert.strictEqual(generalRejection.body.data.verificationStatus, 'rejected');
    assert.strictEqual(generalRejection.body.data.kycStatus, 'PENDING');

    const approval = await request(
      'PATCH',
      `/providers/admin/${provider._id}/kyc/review`,
      adminToken,
      { status: 'approved' }
    );
    assert.strictEqual(approval.status, 200);
    assert.strictEqual(approval.body.data.kycStatus, 'APPROVED');
    assert.strictEqual(approval.body.data.verificationStatus, 'rejected');
    assert.strictEqual(approval.body.data.user.isVerified, false);
    assert.strictEqual(approval.body.data.serviceCertification.verificationStatus, 'VERIFIED');
    assert.ok(approval.body.data.kycReviewedAt);
    assert.strictEqual(String(approval.body.data.kycReviewedBy._id), String(adminUser._id));
    for (const type of Object.values(documentTypes)) {
      const reviewedDocument = approval.body.data.documents.find((document) => document.type === type);
      assert.strictEqual(reviewedDocument.verificationStatus, 'approved');
      assert.strictEqual(String(reviewedDocument.reviewedBy._id), String(adminUser._id));
      assert.ok(reviewedDocument.reviewedAt);
      assert.strictEqual(
        `${new Date(reviewedDocument.reviewedAt).toISOString()}:${reviewedDocument.reviewedBy._id}`,
        documentAuditBeforeKycApproval[type],
        'Overall KYC approval must preserve individual document review history'
      );
    }

    const approvedAssetDeleteCount = deletedAssets.length;
    const approvedProfile = await request('GET', '/providers/me', providerToken);
    assert.strictEqual(approvedProfile.status, 200);
    assert.strictEqual(approvedProfile.body.data.kycStatus, 'APPROVED');
    assert.strictEqual(approvedProfile.body.data.verificationStatus, 'rejected');
    assert.strictEqual(approvedProfile.body.data.user.isVerified, false);
    assert.strictEqual(approvedProfile.body.data.serviceCertification.verificationStatus, 'VERIFIED');
    assert.ok(approvedProfile.body.data.kycReviewedAt);
    assert.strictEqual(
      approvedProfile.body.data.aadhaarFrontImage,
      correctedDocuments.aadhaarFrontImage
    );
    const approvedDocumentId = approvedProfile.body.data.documents.find(
      (document) => document.type === 'aadhaar_front'
    )._id;
    const approvedLegacyDelete = await request(
      'DELETE',
      `/providers/me/documents/${approvedDocumentId}`,
      providerToken
    );
    assert.strictEqual(approvedLegacyDelete.status, 409);
    const approvedLegacyUpload = await request(
      'POST',
      '/providers/me/documents',
      providerToken,
      {
        type: 'aadhaar_front',
        documentUrl: 'https://storage.test/approved-document-tamper.jpg'
      }
    );
    assert.strictEqual(approvedLegacyUpload.status, 409);
    const approvedProfileTamper = await request(
      'PUT',
      '/providers/me',
      providerToken,
      {
        kycStatus: 'NOT_SUBMITTED',
        aadhaarFrontImage: 'https://storage.test/approved-document-tamper.jpg'
      }
    );
    assert.strictEqual(approvedProfileTamper.status, 403);

    const approvedDelete = await request(
      'DELETE',
      '/providers/me/kyc/pan_back',
      providerToken
    );
    assert.strictEqual(approvedDelete.status, 409);

    const approvedUpload = await requestMultipart(
      '/providers/me/kyc/upload',
      providerToken,
      'pan_back',
      'must not replace approved KYC'
    );
    assert.strictEqual(approvedUpload.status, 409, JSON.stringify(approvedUpload.body));

    const approvedResubmission = await request(
      'POST',
      '/providers/me/kyc/submit',
      providerToken,
      correctedDocuments
    );
    assert.strictEqual(approvedResubmission.status, 409);
    assert.strictEqual(
      deletedAssets.length,
      approvedAssetDeleteCount,
      'Attempts to modify approved documents must not delete their stored assets'
    );

    const duplicateReview = await request(
      'PATCH',
      `/providers/admin/${provider._id}/kyc/review`,
      adminToken,
      { status: 'rejected', rejectionReason: 'Invalid repeat review', rejectedDocuments: ['pan_back'] }
    );
    assert.strictEqual(duplicateReview.status, 409);

    console.log('Provider KYC workflow tests passed for submission, locking, authorization, rejection, and approval.');
  } finally {
    await teardown();
  }
}

run().catch((error) => {
  console.error('Provider KYC workflow tests failed:', error);
  process.exitCode = 1;
});
