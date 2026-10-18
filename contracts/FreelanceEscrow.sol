// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FreelanceEscrow
 * @notice Holds payment for a freelance job until it is released, refunded,
 *         or resolved by the nominated arbiter.
 */
contract FreelanceEscrow {
    enum Status {
        Funded,
        Released,
        Refunded
    }

    struct Escrow {
        address payable payer;
        address payable payee;
        address arbiter;
        uint256 amount;
        uint256 createdAt;
        Status status;
        bool disputed;
        string serviceReference;
    }

    error ZeroAddress();
    error InvalidAmount();
    error DuplicateParticipant();
    error ReferenceRequired();
    error ReferenceTooLong();
    error EscrowNotFound();
    error EscrowNotFunded();
    error Unauthorized();
    error DisputeAlreadyRaised();
    error DisputeRequired();
    error TransferFailed();

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed payer,
        address indexed payee,
        address arbiter,
        uint256 amount,
        string serviceReference
    );
    event DisputeRaised(uint256 indexed escrowId, address indexed raisedBy);
    event EscrowReleased(uint256 indexed escrowId, address indexed payee, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, address indexed payer, uint256 amount);
    event DisputeResolved(
        uint256 indexed escrowId,
        address indexed arbiter,
        address indexed recipient,
        uint256 amount
    );

    Escrow[] private escrows;
    mapping(address => uint256[]) private participantEscrowIds;
    uint256 private locked = 1;

    modifier nonReentrant() {
        require(locked == 1, "Reentrant call");
        locked = 2;
        _;
        locked = 1;
    }

    modifier validEscrow(uint256 escrowId) {
        if (escrowId >= escrows.length) revert EscrowNotFound();
        _;
    }

    function createEscrow(
        address payable payee,
        address arbiter,
        string calldata serviceReference
    ) external payable returns (uint256 escrowId) {
        if (payee == address(0) || arbiter == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert InvalidAmount();
        if (msg.sender == payee || msg.sender == arbiter || payee == arbiter) {
            revert DuplicateParticipant();
        }

        uint256 serviceReferenceLength = bytes(serviceReference).length;
        if (serviceReferenceLength == 0) revert ReferenceRequired();
        if (serviceReferenceLength > 120) revert ReferenceTooLong();

        escrowId = escrows.length;
        escrows.push(
            Escrow({
                payer: payable(msg.sender),
                payee: payee,
                arbiter: arbiter,
                amount: msg.value,
                createdAt: block.timestamp,
                status: Status.Funded,
                disputed: false,
                serviceReference: serviceReference
            })
        );

        participantEscrowIds[msg.sender].push(escrowId);
        participantEscrowIds[payee].push(escrowId);
        participantEscrowIds[arbiter].push(escrowId);

        emit EscrowCreated(escrowId, msg.sender, payee, arbiter, msg.value, serviceReference);
    }

    function releaseEscrow(uint256 escrowId)
        external
        nonReentrant
        validEscrow(escrowId)
    {
        Escrow storage item = escrows[escrowId];
        _requireFunded(item);
        if (msg.sender != item.payer) revert Unauthorized();
        if (item.disputed) revert DisputeAlreadyRaised();

        item.status = Status.Released;
        _sendValue(item.payee, item.amount);
        emit EscrowReleased(escrowId, item.payee, item.amount);
    }

    function refundEscrow(uint256 escrowId)
        external
        nonReentrant
        validEscrow(escrowId)
    {
        Escrow storage item = escrows[escrowId];
        _requireFunded(item);
        if (msg.sender != item.payee) revert Unauthorized();
        if (item.disputed) revert DisputeAlreadyRaised();

        item.status = Status.Refunded;
        _sendValue(item.payer, item.amount);
        emit EscrowRefunded(escrowId, item.payer, item.amount);
    }

    function raiseDispute(uint256 escrowId) external validEscrow(escrowId) {
        Escrow storage item = escrows[escrowId];
        _requireFunded(item);
        if (msg.sender != item.payer && msg.sender != item.payee) revert Unauthorized();
        if (item.disputed) revert DisputeAlreadyRaised();

        item.disputed = true;
        emit DisputeRaised(escrowId, msg.sender);
    }

    function resolveDispute(uint256 escrowId, bool releaseToPayee)
        external
        nonReentrant
        validEscrow(escrowId)
    {
        Escrow storage item = escrows[escrowId];
        _requireFunded(item);
        if (msg.sender != item.arbiter) revert Unauthorized();
        if (!item.disputed) revert DisputeRequired();

        address payable recipient;
        if (releaseToPayee) {
            item.status = Status.Released;
            recipient = item.payee;
        } else {
            item.status = Status.Refunded;
            recipient = item.payer;
        }

        _sendValue(recipient, item.amount);
        emit DisputeResolved(escrowId, msg.sender, recipient, item.amount);
    }

    function getEscrow(uint256 escrowId)
        external
        view
        validEscrow(escrowId)
        returns (Escrow memory)
    {
        return escrows[escrowId];
    }

    function getEscrowIdsFor(address participant) external view returns (uint256[] memory) {
        return participantEscrowIds[participant];
    }

    function escrowCount() external view returns (uint256) {
        return escrows.length;
    }

    function _requireFunded(Escrow storage item) private view {
        if (item.status != Status.Funded) revert EscrowNotFunded();
    }

    function _sendValue(address payable recipient, uint256 amount) private {
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
    }
}
