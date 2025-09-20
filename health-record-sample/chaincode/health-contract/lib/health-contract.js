'use strict';

const { Contract } = require('fabric-contract-api');

class HealthContract extends Contract {

  // namespace prefix helpers
  recordKey(patientId, recordId) {
    return `record_${patientId}_${recordId}`;
  }

  // Init ledger (optional)
  async initLedger(ctx) {
    console.info('Ledger initialized');
  }

  // Create a patient record entry (doctor only)
  // recordData is JSON string containing details
  async addRecord(ctx, patientId, recordId, recordData) {
    const role = ctx.clientIdentity.getAttributeValue('role');
    if (!role || role !== 'doctor') {
      throw new Error('Only identities with role=doctor can add records');
    }

    const key = this.recordKey(patientId, recordId);
    const exists = await ctx.stub.getState(key);
    if (exists && exists.length > 0) {
      throw new Error(`Record ${recordId} for patient ${patientId} already exists`);
    }

    // Optionally record who created it
    const creator = ctx.clientIdentity.getID(); // invoker identity
    const entry = {
      patientId,
      recordId,
      recordData: JSON.parse(recordData),
      createdBy: creator,
      createdAt: new Date().toISOString()
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(entry)));
    return JSON.stringify(entry);
  }

  // Get single record - only patient who owns the record OR doctor can view
  async getRecord(ctx, patientId, recordId) {
    const role = ctx.clientIdentity.getAttributeValue('role');
    const invokerId = ctx.clientIdentity.getID();

    const key = this.recordKey(patientId, recordId);
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) {
      throw new Error('Record not found');
    }
    const entry = JSON.parse(data.toString());

    // If requester is doctor -> allow
    if (role === 'doctor') {
      return JSON.stringify(entry);
    }

    // If requester is patient -> check that invoker matches patient identity
    // We'll compare invoker's enrollmentID (or MSP ID) to patientId string
    // Convention: when registering patient user, use enrollment ID = patientId
    const invokerEnrollmentID = ctx.clientIdentity.getAttributeValue('hf.EnrollmentID') || null;
    // if above not available, fallback to extracting from full ID string:
    const fullId = invokerEnrollmentID || invokerId;
    if (fullId.includes(patientId) || patientId === invokerEnrollmentID) {
      return JSON.stringify(entry);
    }

    throw new Error('Access denied: only the patient owner or a doctor can read this record');
  }

  // List records for a patient (patient or doctor)
  async queryRecordsByPatient(ctx, patientId) {
    const role = ctx.clientIdentity.getAttributeValue('role');
    const invokerId = ctx.clientIdentity.getID();
    // Access check: doctor OR same patient
    if (role !== 'doctor') {
      // patient check (same as in getRecord)
      const invokerEnrollmentID = ctx.clientIdentity.getAttributeValue('hf.EnrollmentID') || null;
      const fullId = invokerEnrollmentID || invokerId;
      if (!fullId.includes(patientId)) {
        throw new Error('Access denied');
      }
    }

    const iterator = await ctx.stub.getStateByRange('', '');
    const results = [];
    while (true) {
      const res = await iterator.next();
      if (res.value && res.value.value.toString()) {
        const key = res.value.key;
        if (key.startsWith(`record_${patientId}_`)) {
          const jsonRes = JSON.parse(res.value.value.toString('utf8'));
          results.push(jsonRes);
        }
      }
      if (res.done) {
        await iterator.close();
        break;
      }
    }
    return JSON.stringify(results);
  }
}

module.exports = HealthContract;
