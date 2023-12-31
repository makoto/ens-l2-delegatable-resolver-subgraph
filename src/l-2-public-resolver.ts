import {
  AddrChanged as AddrChangedEvent,
  AddressChanged as AddressChangedEvent,
  TextChanged as TextChangedEvent,
  ContenthashChanged as ContenthashChangedEvent,
  Approval as ApprovalEvent
} from "../generated/DelegatableResolver/DelegatableResolver"

import {
  AddrChanged,
  AddressChanged,
  ContenthashChanged,
  TextChanged,
  Approval,
  Resolver,
  Domain,
  Account
} from "../generated/schema"
import { Address, BigInt, Bytes, crypto, log } from '@graphprotocol/graph-ts'
import {
  decodeName,
  namehash,
  byteArrayFromHex,
  encodeHex
} from './utils'

export function handleApproval(event: ApprovalEvent): void {
  let entity = new Approval(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let decoded = decodeName(event.params.name)
  let name = ''
  if(decoded){    
    name = decoded ? decoded[1] : ''
  }
  let context = Bytes.fromHexString(event.address.toHexString())
  let node = event.params.node
  let operator = event.params.operator
  let approved = event.params.approved
  entity.name = name
  entity.node = node
  entity.context = context
  entity.operator = operator
  entity.approved = approved
  handleName(node, context, event.params.name)
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
  let domainId = createDomainID(node, context);
  let domain = Domain.load(domainId);
  if(domain){
    let delegateAccount = Account.load(operator.toHexString());
    if(!delegateAccount){
      delegateAccount = new Account(operator.toHexString());
    }
    if(domain.delegates == null) {
      if(approved === true){
        domain.delegates = [delegateAccount.id];
        domain.save();  
      }
    } else {
      let delegates = domain.delegates!
      if(approved === true){
        if(!delegates.includes(delegateAccount.id)){        
          delegates.push(delegateAccount.id)
          domain.delegates = delegates
          domain.save()
        }  
      }else{
        const index = delegates.indexOf(delegateAccount.id)
        if(index >= 0){
          // Remove delegation
          delegates.splice(index, 1)
          domain.delegates = delegates
          domain.save()
        }  
      }
    }
    delegateAccount.save()
  }
}

export function handleName(node:Bytes, context:Bytes, dnsName:Bytes): void { 
  let domainId = createDomainID(node, context);
  let domain = Domain.load(domainId);
  if(!domain){
    domain = new Domain(domainId)
  }
  let decoded = decodeName(dnsName)
  if(decoded){    
    let labelName = decoded[0]
    let labelHex = encodeHex(labelName)
    let labelhash = crypto.keccak256(byteArrayFromHex(labelHex)).toHex()
    let name = decoded ? decoded[1] : ''
    domain.name = name
    domain.labelName = labelName
    domain.labelhash = Bytes.fromHexString(labelhash)
    if(decoded.length > 2){
      let parentEncoded = decoded ? decoded[3] : ''
      let parentNode = namehash(Bytes.fromHexString(parentEncoded))
      let parentDomainId = createDomainID(parentNode, context);
      let parentDomain = createDomain(
        parentNode,
        context
      )
      parentDomain.save()
      domain.parent = parentDomainId
      if(parentDomain.name == null){
        let decodedParent = decodeName(Bytes.fromHexString(parentEncoded))
        let parentLabelName = decodedParent ? decodedParent[0] : ''
        let parentLabelHex = encodeHex(parentLabelName)
        let parentLabelhash = crypto.keccak256(byteArrayFromHex(parentLabelHex)).toHex()
        let parentName = decodedParent ? decodedParent[1] : ''
        let parentParentName = decodedParent ? decodedParent[2] : ''
        parentDomain.name = parentName
        parentDomain.labelName = parentLabelName
        parentDomain.labelhash = Bytes.fromHexString(parentLabelhash)
      }
      parentDomain.save()  
    }
  }
  domain.save()
}

export function handleAddrChanged(event: AddrChangedEvent): void {
  let entity = new AddrChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let context = Bytes.fromHexString(event.address.toHexString())
  let resolver = getOrCreateResolver(
    event.params.node,
    context,
    event.address,
  )
  resolver.addr = event.params.a;
  resolver.domain = createDomainID(event.params.node, context)
  resolver.save();
  let domain = createDomain(
    event.params.node,
    context,
    resolver.id
  )
  domain.resolvedAddress = event.params.a;
  domain.save()
  entity.context = context
  entity.node = event.params.node
  entity.a = event.params.a

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
}

export function handleAddressChanged(event: AddressChangedEvent): void {
  let entity = new AddressChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let context = Bytes.fromHexString(event.address.toHexString())
  entity.node = event.params.node
  entity.context = context
  entity.coinType = event.params.coinType
  entity.newAddress = event.params.newAddress
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()
  let resolver = getOrCreateResolver(
    event.params.node,
    context,
    event.address,
  )
  resolver.save();
  let domain = createDomain(
    event.params.node,
    context,
    resolver.id
  )
  domain.save()
  let coinType = event.params.coinType
  if(resolver.coinTypes == null) {
    resolver.coinTypes = [coinType];
    resolver.save();
  } else {
    let coinTypes = resolver.coinTypes!
    if(!coinTypes.includes(coinType)){
      coinTypes.push(coinType)
      resolver.coinTypes = coinTypes
      resolver.save()
    }
  }
}

export function handleTextChanged(event: TextChangedEvent): void {
  let entity = new TextChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let context = Bytes.fromHexString(event.address.toHexString())
  entity.node = event.params.node
  entity.context = context
  entity.key = event.params.key

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  let resolver = getOrCreateResolver(
    event.params.node,
    context,
    event.address,
  )
  let key = event.params.key;
  if(resolver.texts == null) {
    resolver.texts = [key];
    resolver.save();
  } else {
    let texts = resolver.texts!
    if(!texts.includes(key)){
      texts.push(key)
      resolver.texts = texts
      resolver.save()
    }
  }
  resolver.save();
  let domain = createDomain(
    event.params.node,
    context,
    resolver.id
  )
  domain.save()
}

export function handleContentHashChanged(event: ContenthashChangedEvent): void {
  let entity = new ContenthashChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let context = Bytes.fromHexString(event.address.toHexString())
  entity.node = event.params.node
  entity.context = context
  entity.hash = event.params.hash
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  entity.save()

  let resolver = getOrCreateResolver(
    event.params.node,
    context,
    event.address,
  )
  resolver.contentHash = event.params.hash;
  resolver.save();
  let domain = createDomain(
    event.params.node,
    context,
    resolver.id
  )
  domain.save()
}

function getOrCreateResolver(node: Bytes, context: Bytes, address: Address): Resolver {
  let id = createResolverID(node, context, address);
  let resolver = Resolver.load(id);
  if (resolver === null) {
    resolver = new Resolver(id);
    resolver.domain = node.toHexString();
    resolver.node = node;
    resolver.context = context;
    resolver.address = address;
  }
  return resolver as Resolver;
}

function createDomain(node: Bytes, context: Bytes, resolverId: string = ''): Domain{
  let domain = new Domain(createDomainID(node, context));  
  domain.namehash = node;
  if(resolverId != ''){
    domain.resolver = resolverId;
    domain.context = context;
  }
  let account = Account.load(context.toHexString());
  if(!account){
    account = new Account(context.toHexString());
  }
  domain.owner = account.id;
  domain.context = context;
  domain.save()
  account.save()
  return domain
}

function createResolverID(node: Bytes, context: Bytes, resolver: Address): string {
  return resolver
    .toHexString()
    .concat("-")
    .concat(
      context
      .toHexString()
      .concat("-")
      .concat(
        node.toHexString()
      )
    );
}

function createDomainID(node: Bytes, context: Bytes): string {
  return context
    .toHexString()
    .concat("-")
    .concat(node.toHexString());
}